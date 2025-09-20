// Brainstorming Canvas Application
class BrainstormingApp {
    constructor() {
        this.currentConcept = null;
        this.concepts = [];
        this.selectedQuestion = null;
        this.currentFilter = 'all';
        this.isDarkMode = this.loadTheme();
        this.user = null;
        this.isSignUp = false;
        
        // Initialize Supabase
        this.supabase = supabase.createClient(
            'https://jfcykejtgxbmarxmhkbw.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmY3lrZWp0Z3hibWFyeG1oa2J3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMTUzMzYsImV4cCI6MjA3Mzg5MTMzNn0.ZdFZOSiSUum7KmVwMiGA5f8CstvxEUcjGL-bpFPeacI'
        );
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.setupInspirationTabs();
        this.setupRandomWords();
        this.applyTheme();
        this.setupAddQuestionButton();
        this.setupClickOutsideDropdowns();
        this.setupMobileNavigation();
        this.setupAutoCleanup();
        this.setupColorDropdownDelegation();
        this.setupSessionManagement();
        
        // Check authentication
        await this.checkAuth();
    }

    async checkAuth() {
        // Always show auth modal - no session persistence
        this.setupAuthEventListeners();
        this.showAuthModal();
    }

    showAuthModal() {
        document.getElementById('loginContainer').classList.remove('hidden');
        document.getElementById('appContainer').style.display = 'none';
    }

    showApp() {
        // Only show app if user is authenticated
        if (!this.user) {
            console.error('Cannot show app - no authenticated user');
            this.showAuthModal();
            return;
        }
        
        document.getElementById('loginContainer').classList.add('hidden');
        document.getElementById('appContainer').style.display = 'flex';
    }

    setupAuthEventListeners() {
        const authForm = document.getElementById('authForm');
        const emailInput = document.getElementById('emailInput');
        const passwordInput = document.getElementById('passwordInput');
        const passwordToggle = document.getElementById('passwordToggle');

        // Password toggle functionality
        passwordToggle.addEventListener('click', () => {
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                passwordToggle.textContent = '🙈';
            } else {
                passwordInput.type = 'password';
                passwordToggle.textContent = '👁️';
            }
        });

        // Auto-submit when both fields are filled (for password manager)
        const autoSubmit = () => {
            if (emailInput.value && passwordInput.value) {
                // Small delay to ensure fields are fully filled
                setTimeout(() => {
                    authForm.dispatchEvent(new Event('submit'));
                }, 100);
            }
        };

        // Listen for input changes to detect auto-fill
        emailInput.addEventListener('input', autoSubmit);
        passwordInput.addEventListener('input', autoSubmit);
        
        // Also listen for focus events (password managers often trigger these)
        emailInput.addEventListener('focus', () => {
            setTimeout(autoSubmit, 200);
        });
        passwordInput.addEventListener('focus', () => {
            setTimeout(autoSubmit, 200);
        });

        // Handle form submission
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevent form submission to avoid file not found
            
            const email = emailInput.value;
            const password = passwordInput.value;
            
            if (!email || !password) {
                alert('Please fill in all fields');
                return;
            }

            try {
                const { data, error } = await this.supabase.auth.signInWithPassword({
                    email,
                    password
                });
                if (error) throw error;
                this.user = data.user;
                this.showApp();
                await this.loadConceptsFromSupabase();
                
                // Clear fields after successful login
                emailInput.value = '';
                passwordInput.value = '';
            } catch (error) {
                alert('Error: ' + error.message);
            }
        });
    }

    // Data Management
    async loadConceptsFromSupabase() {
        // Security check - only load data if authenticated
        if (!this.user) {
            console.error('Cannot load data - no authenticated user');
            this.showAuthModal();
            return;
        }
        
        try {
            // First, clean up any grey ideas that were marked for deletion
            await this.cleanupStoredGreyIdeas();

            // Load concepts
            const { data: concepts, error: conceptsError } = await this.supabase
                .from('concepts')
                .select(`
                    *,
                    sessions (
                        *,
                        questions (
                            *,
                            ideas (*)
                        )
                    )
                `)
                .eq('user_id', this.user.id)
                .order('created_at', { ascending: false });

            if (conceptsError) throw conceptsError;

            // Map Supabase data structure to local structure
            this.concepts = (concepts || []).map(concept => ({
                ...concept,
                sessions: concept.sessions.map(session => ({
                    ...session,
                    questions: session.questions.map(question => ({
                        ...question,
                        answers: question.ideas || [] // Map 'ideas' to 'answers'
                    }))
                }))
            }));

            this.renderConcepts();
        
        // Load first concept if available
        if (this.concepts.length > 0) {
            this.switchConcept(this.concepts[0].id);
            }
        } catch (error) {
            console.error('Error loading concepts:', error);
            alert('Error loading data: ' + error.message);
        }
    }

    async cleanupStoredGreyIdeas() {
        try {
            const storedIds = localStorage.getItem('grey-ideas-to-delete');
            if (storedIds) {
                const greyIdeaIds = JSON.parse(storedIds);
                if (greyIdeaIds.length > 0) {
                    const { error } = await this.supabase
                        .from('ideas')
                        .delete()
                        .in('id', greyIdeaIds)
                        .eq('user_id', this.user.id);

                    if (error) throw error;
                }
                localStorage.removeItem('grey-ideas-to-delete');
            }
        } catch (error) {
            console.error('Error cleaning up stored grey ideas:', error);
        }
    }

    loadConcepts() {
        const saved = localStorage.getItem('brainstorming-concepts');
        if (saved) {
            const concepts = JSON.parse(saved);
            // Migrate old format to new session-based format
            concepts.forEach(concept => {
                if (concept.title && !concept.name) {
                    concept.name = concept.title;
                    delete concept.title;
                }
                
                // If concept doesn't have sessions, migrate it
                if (!concept.sessions) {
                    concept.sessions = [{
                        id: this.generateId(),
                        name: 'Session 1',
                        questions: concept.questions || [],
                        createdAt: concept.createdAt || new Date().toISOString()
                    }];
                    concept.currentSessionId = concept.sessions[0].id;
                    delete concept.questions; // Remove old questions array
                }
            });
            return concepts;
        } else {
            // Create default concepts if none exist
            const defaultConcepts = [
                {
                    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
                    name: 'Main Canvas - Sticky Notes Variant',
                    sessions: [{
                        id: this.generateId(),
                        name: 'Session 1',
                        questions: [],
                        createdAt: new Date().toISOString()
                    }],
                    currentSessionId: null,
                    createdAt: new Date().toISOString()
                }
            ];
            defaultConcepts[0].currentSessionId = defaultConcepts[0].sessions[0].id;
            localStorage.setItem('brainstorming-concepts', JSON.stringify(defaultConcepts));
            return defaultConcepts;
        }
    }

    saveConcepts() {
        localStorage.setItem('brainstorming-concepts', JSON.stringify(this.concepts));
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Theme Management
    loadTheme() {
        const saved = localStorage.getItem('brainstorming-theme');
        return saved === 'dark';
    }

    saveTheme() {
        localStorage.setItem('brainstorming-theme', this.isDarkMode ? 'dark' : 'light');
    }

    toggleTheme() {
        this.isDarkMode = !this.isDarkMode;
        this.applyTheme();
        this.saveTheme();
    }

    applyTheme() {
        const body = document.body;
        const themeToggle = document.getElementById('themeToggle');
        
        if (this.isDarkMode) {
            body.setAttribute('data-theme', 'dark');
            if (themeToggle) {
            themeToggle.textContent = '☀️';
            themeToggle.title = 'Switch to Light Mode';
            }
        } else {
            body.removeAttribute('data-theme');
            if (themeToggle) {
            themeToggle.textContent = '🌙';
            themeToggle.title = 'Switch to Dark Mode';
            }
        }
    }


    // Mobile-specific functions
    toggleQuestionMobile(questionId) {
        const question = this.currentConcept.questions.find(q => q.id === questionId);
        if (question) {
            question.expanded = !question.expanded;
            this.renderBrainstormingArea();
        }
    }

    showColorDropdown(answerId) {
        console.log('showColorDropdown called for:', answerId);
        
        // Hide all other dropdowns
        document.querySelectorAll('.color-dropdown').forEach(dropdown => {
            dropdown.classList.remove('show');
            dropdown.remove(); // Remove from DOM
        });
        
        // Create new dropdown and append to body
        const dropdown = document.createElement('div');
        dropdown.className = 'color-dropdown';
        dropdown.id = `colorDropdown-${answerId}`;
        dropdown.innerHTML = `
            <div class="color-option color-grey">Trash</div>
            <div class="color-option color-yellow">Maybe</div>
            <div class="color-option color-blue">Decent</div>
            <div class="color-option color-purple">Strong</div>
            <div class="color-option color-green">Keeper</div>
        `;
        
        // Append to body
        document.body.appendChild(dropdown);
        
        // Get the position of the color dot
        const colorDot = document.querySelector(`[onclick*="showColorDropdown('${answerId}')"]`);
        if (colorDot) {
            const rect = colorDot.getBoundingClientRect();
            
            // Position the dropdown relative to the color dot using fixed positioning
            dropdown.style.left = (rect.right - 100) + 'px'; // 100px is the dropdown width
            dropdown.style.top = (rect.bottom + 4) + 'px';
            dropdown.style.pointerEvents = 'auto'; // Ensure clicks work
            dropdown.style.position = 'fixed'; // Ensure it's fixed
            dropdown.style.zIndex = '9999'; // Ensure it's on top
            
            // Debug: Log the positioning
            console.log('Dropdown positioned at:', {
                left: dropdown.style.left,
                top: dropdown.style.top,
                rect: rect
            });
            
            dropdown.classList.add('show');
            console.log('Added show class to dropdown');
        } else {
            console.log('Color dot element not found!');
        }
    }

    async colorAnswer(answerId, color) {
        // Hide and remove dropdown
        document.querySelectorAll('.color-dropdown').forEach(dropdown => {
            dropdown.classList.remove('show');
            dropdown.remove(); // Remove from DOM
        });
        
        try {
            // Update color in Supabase
            const { error } = await this.supabase
                .from('ideas')
                .update({ color: color })
                .eq('id', answerId)
                .eq('user_id', this.user.id);

            if (error) throw error;

            // Update local data
            const currentSession = this.currentConcept.sessions.find(s => s.id === this.currentConcept.currentSessionId);
            if (currentSession) {
                for (const question of currentSession.questions) {
                    const answer = question.answers.find(a => a.id === answerId);
        if (answer) {
            answer.color = color;
                        break;
                    }
                }
            }

            this.renderBrainstormingArea();
        } catch (error) {
            console.error('Error updating answer color:', error);
            alert('Error updating color: ' + error.message);
        }
    }

    editAnswer(answerId) {
        const answerElement = document.querySelector(`[data-answer-id="${answerId}"] .answer-content`);
        if (!answerElement) return;

        const currentText = answerElement.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.className = 'edit-input';
        input.style.cssText = `
            width: 100%;
            padding: 4px 8px;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            background: var(--bg-primary);
            color: var(--text-primary);
            font-size: inherit;
            font-family: inherit;
        `;

        // Replace content with input
        answerElement.innerHTML = '';
        answerElement.appendChild(input);
        input.focus();
        input.select();

        // Handle save on Enter or blur
        const saveEdit = async () => {
            const newText = input.value.trim();
            if (newText && newText !== currentText) {
                try {
                    // Update in Supabase
                    const { error } = await this.supabase
                        .from('ideas')
                        .update({ text: newText })
                        .eq('id', answerId)
                        .eq('user_id', this.user.id);

                    if (error) throw error;

                    // Update local data
                    const currentSession = this.currentConcept.sessions.find(s => s.id === this.currentConcept.currentSessionId);
                    if (currentSession) {
                        for (const question of currentSession.questions) {
                            const answer = question.answers.find(a => a.id === answerId);
                            if (answer) {
                                answer.text = newText;
                                break;
                            }
                        }
                    }

                    // Re-render
                    this.renderBrainstormingArea();
                } catch (error) {
                    console.error('Error updating answer:', error);
                    alert('Error updating idea: ' + error.message);
                }
            } else {
                // Restore original text
                answerElement.textContent = currentText;
            }
        };

        input.addEventListener('blur', saveEdit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveEdit();
            } else if (e.key === 'Escape') {
                answerElement.textContent = currentText;
            }
        });
    }

    editQuestion(questionId) {
        const questionElement = document.querySelector(`[data-question-id="${questionId}"]`).previousElementSibling.querySelector('.question-title');
        if (!questionElement) return;

        const currentText = questionElement.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.className = 'edit-input';
        input.style.cssText = `
            width: 100%;
            padding: 4px 8px;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            background: var(--bg-primary);
            color: var(--text-primary);
            font-size: inherit;
            font-family: inherit;
        `;

        // Replace content with input
        questionElement.innerHTML = '';
        questionElement.appendChild(input);
        input.focus();
        input.select();

        // Handle save on Enter or blur
        const saveEdit = async () => {
            const newText = input.value.trim();
            if (newText && newText !== currentText) {
                try {
                    // Update in Supabase
                    const { error } = await this.supabase
                        .from('questions')
                        .update({ text: newText })
                        .eq('id', questionId)
                        .eq('user_id', this.user.id);

                    if (error) throw error;

                    // Update local data
                    const currentSession = this.currentConcept.sessions.find(s => s.id === this.currentConcept.currentSessionId);
                    if (currentSession) {
                        const question = currentSession.questions.find(q => q.id === questionId);
                        if (question) {
                            question.text = newText;
                        }
                    }

                    // Re-render
                    this.renderBrainstormingArea();
                } catch (error) {
                    console.error('Error updating question:', error);
                    alert('Error updating question: ' + error.message);
                }
            } else {
                // Restore original text
                questionElement.textContent = currentText;
            }
        };

        input.addEventListener('blur', saveEdit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveEdit();
            } else if (e.key === 'Escape') {
                questionElement.textContent = currentText;
            }
        });
    }

    setupAddQuestionButton() {
        const addQuestionBtn = document.getElementById('addQuestionBtn');
        if (addQuestionBtn) {
            addQuestionBtn.addEventListener('click', () => {
                this.addQuestion();
            });
        }
    }

    setupClickOutsideDropdowns() {
        document.addEventListener('click', (e) => {
            // Close color dropdowns - but NOT if clicking on color options
            if (!e.target.closest('.answer-color-dot') && 
                !e.target.closest('.color-dropdown') && 
                !e.target.classList.contains('color-option')) {
                document.querySelectorAll('.color-dropdown').forEach(dropdown => {
                    dropdown.classList.remove('show');
                    dropdown.remove(); // Remove from DOM
                });
            }
            
            // Close filter dropdown
            if (!e.target.closest('.idea-filter')) {
                const filterDropdown = document.getElementById('filterDropdown');
                if (filterDropdown) {
                    filterDropdown.classList.remove('show');
                }
            }
            
            // Collapse expanded answer text
            if (!e.target.closest('.answer-content')) {
                document.querySelectorAll('.answer-content.expanded').forEach(content => {
                    content.classList.remove('expanded');
                    content.classList.add('truncated');
                });
            }
        });
    }

    // Mobile Navigation
    setupMobileNavigation() {
        const navItems = document.querySelectorAll('.bottom-nav .nav-item');
        
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const tab = item.dataset.tab;
                this.switchMobileTab(tab);
            });
        });
    }

    setupAutoCleanup() {
        // Clean up grey ideas when page is about to unload
        window.addEventListener('beforeunload', () => {
            // Store grey idea IDs in localStorage for cleanup on next load
            const greyIdeaIds = this.getGreyIdeaIds();
            if (greyIdeaIds.length > 0) {
                localStorage.setItem('grey-ideas-to-delete', JSON.stringify(greyIdeaIds));
            }
        });

        // Also clean up on page visibility change (when switching tabs)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.cleanupGreyIdeas();
            }
        });
    }

    setupSessionManagement() {
        // Sign out when page is refreshed or closed to prevent session persistence
        window.addEventListener('beforeunload', async () => {
            if (this.user) {
                await this.supabase.auth.signOut();
            }
        });

        // Also sign out when page becomes hidden (tab switch, minimize, etc.)
        document.addEventListener('visibilitychange', async () => {
            if (document.hidden && this.user) {
                await this.supabase.auth.signOut();
            }
        });
    }

    setupColorDropdownDelegation() {
        // Use event delegation to handle clicks on dynamically generated color options
        document.addEventListener('click', (e) => {
            console.log('Click detected on:', e.target, 'Classes:', e.target.classList);
            
            if (e.target.classList.contains('color-option')) {
                console.log('Color option clicked!');
                e.preventDefault(); // Prevent default behavior
                e.stopPropagation(); // Stop event from bubbling up
                e.stopImmediatePropagation(); // Stop other event listeners on same element
                
                // Find the parent dropdown to get the answer ID
                const dropdown = e.target.closest('.color-dropdown');
                if (dropdown) {
                    const answerId = dropdown.id.replace('colorDropdown-', '');
                    
                    // Determine the color from the class
                    const color = e.target.classList.contains('color-grey') ? 'grey' :
                                 e.target.classList.contains('color-yellow') ? 'yellow' :
                                 e.target.classList.contains('color-blue') ? 'blue' :
                                 e.target.classList.contains('color-purple') ? 'purple' :
                                 e.target.classList.contains('color-green') ? 'green' : 'grey';
                    
                    console.log('Calling colorAnswer with:', answerId, color);
                    this.colorAnswer(answerId, color);
                } else {
                    console.log('No dropdown found!');
                }
            }
        });
    }

    getGreyIdeaIds() {
        const greyIdeaIds = [];
        
        if (!this.concepts || this.concepts.length === 0) return greyIdeaIds;
        
        this.concepts.forEach(concept => {
            if (!concept.sessions || concept.sessions.length === 0) return;
            
            concept.sessions.forEach(session => {
                if (!session.questions || session.questions.length === 0) return;
                
                session.questions.forEach(question => {
                    if (!question.answers || question.answers.length === 0) return;
                    
                    question.answers.forEach(answer => {
                        if (answer.color === 'grey') {
                            greyIdeaIds.push(answer.id);
                        }
                    });
                });
            });
        });
        
        return greyIdeaIds;
    }

    async cleanupGreyIdeas() {
        if (!this.concepts || this.concepts.length === 0) return;
        
        try {
            // Collect all grey idea IDs to delete from Supabase
            const greyIdeaIds = this.getGreyIdeaIds();

            // Delete grey ideas from Supabase
            if (greyIdeaIds.length > 0) {
                const { error } = await this.supabase
                    .from('ideas')
                    .delete()
                    .in('id', greyIdeaIds)
                    .eq('user_id', this.user.id);

                if (error) throw error;
            }

            // Update local data
            this.concepts.forEach(concept => {
                if (!concept.sessions || concept.sessions.length === 0) return;
                
                concept.sessions.forEach(session => {
                    if (!session.questions || session.questions.length === 0) return;
                    
                    session.questions = session.questions.filter(question => {
                        if (!question.answers || question.answers.length === 0) return false;
                        
                        question.answers = question.answers.filter(answer => answer.color !== 'grey');
                        return question.answers.length > 0; // Remove questions with no answers
                    });
                });
            });

        } catch (error) {
            console.error('Error cleaning up grey ideas:', error);
        }
    }

    showRankedIdeas() {
        // Collect all ideas from all concepts
        const allIdeas = [];
        
        if (!this.concepts || this.concepts.length === 0) {
            // No concepts available
            this.renderEmptyRankedIdeas();
            return;
        }
        
        this.concepts.forEach(concept => {
            if (!concept.sessions || concept.sessions.length === 0) return;
            
            concept.sessions.forEach(session => {
                if (!session.questions || session.questions.length === 0) return;
                
                session.questions.forEach(question => {
                    if (!question.answers || question.answers.length === 0) return;
                    
                    question.answers.forEach(answer => {
                        allIdeas.push({
                            ...answer,
                            conceptName: concept.name,
                            questionText: question.text
                        });
                    });
                });
            });
        });

        // Sort by color priority: Green > Purple > Blue > Yellow
        const colorPriority = { 'green': 4, 'purple': 3, 'blue': 2, 'yellow': 1 };
        allIdeas.sort((a, b) => {
            const aPriority = colorPriority[a.color] || 0;
            const bPriority = colorPriority[b.color] || 0;
            return bPriority - aPriority; // Higher priority first
        });

        // Update canvas header
        document.getElementById('currentConceptTitle').textContent = 'Ranked Ideas';
        
        // Hide the ranked button and session selector
        const rankedBtn = document.getElementById('rankedBtn');
        if (rankedBtn) {
            rankedBtn.style.display = 'none';
        }
        
        const sessionSelector = document.getElementById('sessionSelector');
        if (sessionSelector) {
            sessionSelector.style.display = 'none';
        }

        // Render ranked ideas
        const brainstormingArea = document.getElementById('brainstormingArea');
        
        if (allIdeas.length === 0) {
            this.renderEmptyRankedIdeas();
            return;
        }

        // Group ideas by color
        const groupedIdeas = {
            'green': allIdeas.filter(idea => idea.color === 'green'),
            'purple': allIdeas.filter(idea => idea.color === 'purple'),
            'blue': allIdeas.filter(idea => idea.color === 'blue'),
            'yellow': allIdeas.filter(idea => idea.color === 'yellow')
        };

        let html = `
            <div class="back-to-canvas-container">
                <button class="back-to-canvas-btn" onclick="app.backToCanvas()">← Back to Canvas</button>
            </div>
        `;
        
        Object.entries(groupedIdeas).forEach(([color, ideas]) => {
            if (ideas.length === 0) return;
            
            const colorLabels = {
                'green': 'Keepers (Green)',
                'purple': 'Strong (Purple)', 
                'blue': 'Decent (Blue)',
                'yellow': 'Maybe (Yellow)'
            };
            
                html += `
                    <div class="ranked-section">
                        <h3 class="ranked-section-title">${colorLabels[color]} (${ideas.length})</h3>
                        <div class="ranked-ideas">
                            ${ideas.map(idea => `
                                <div class="ranked-idea-item color-${color}">
                                    <div class="ranked-idea-content">${idea.text}</div>
                                    <div class="ranked-idea-meta">
                                        <span class="concept-name">${idea.conceptName}</span>
                                        <span class="question-text">${idea.questionText}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
        });

        brainstormingArea.innerHTML = html;
    }

    renderEmptyRankedIdeas() {
        const brainstormingArea = document.getElementById('brainstormingArea');
        if (!brainstormingArea) return;
        
        brainstormingArea.innerHTML = `
            <div class="welcome-message">
                <p>No ideas found!</p>
                <p>Start brainstorming to see your ranked ideas here.</p>
                <button class="back-to-canvas-btn" onclick="app.backToCanvas()">← Back to Canvas</button>
            </div>
        `;
    }

    backToCanvas() {
        // Show the ranked button again
        const rankedBtn = document.getElementById('rankedBtn');
        if (rankedBtn) {
            rankedBtn.style.display = 'inline-block';
        }
        
        // Show session selector again
        const sessionSelector = document.getElementById('sessionSelector');
        if (sessionSelector && this.currentConcept) {
            sessionSelector.style.display = 'flex';
        }
        
        // Restore the original concept title
        if (this.currentConcept) {
            document.getElementById('currentConceptTitle').textContent = this.currentConcept.name;
        } else {
            document.getElementById('currentConceptTitle').textContent = 'Select a concept to start brainstorming';
        }
        
        // Re-render the brainstorming area
        this.renderBrainstormingArea();
    }

    renderSessionSelector() {
        const sessionSelector = document.getElementById('sessionSelector');
        const sessionSelect = document.getElementById('sessionSelect');
        
        if (!sessionSelector || !sessionSelect || !this.currentConcept) {
            if (sessionSelector) sessionSelector.style.display = 'none';
            return;
        }

        // Show session selector
        sessionSelector.style.display = 'flex';
        
        // Populate session options
        sessionSelect.innerHTML = '<option value="">Select Session</option>';
        this.currentConcept.sessions.forEach(session => {
            const option = document.createElement('option');
            option.value = session.id;
            option.textContent = session.name;
            option.selected = session.id === this.currentConcept.currentSessionId;
            sessionSelect.appendChild(option);
        });
    }

    switchSession(sessionId) {
        if (!this.currentConcept || !sessionId) return;
        
        this.currentConcept.currentSessionId = sessionId;
        this.saveConcepts();
        this.renderBrainstormingArea();
    }

    addSession() {
        if (!this.currentConcept) return;
        
        const sessionName = prompt('Enter session name:');
        if (!sessionName || !sessionName.trim()) return;
        
        const newSession = {
            id: this.generateId(),
            name: sessionName.trim(),
            questions: [],
            createdAt: new Date().toISOString()
        };
        
        this.currentConcept.sessions.push(newSession);
        this.currentConcept.currentSessionId = newSession.id;
        this.saveConcepts();
        this.renderSessionSelector();
        this.renderBrainstormingArea();
    }

    switchMobileTab(tab) {
        // Only work on mobile screens
        if (window.innerWidth > 480) {
            return;
        }
        
        // Update active nav item
        document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.tab === tab);
        });

        // Show/hide panels based on tab
        const leftPanel = document.getElementById('leftPanel');
        const rightPanel = document.getElementById('rightPanel');
        const mainCanvas = document.querySelector('.main-canvas');

        // Remove mobile-active classes and reset display
        leftPanel.classList.remove('mobile-active');
        rightPanel.classList.remove('mobile-active');
        leftPanel.style.display = 'none';
        rightPanel.style.display = 'none';
        mainCanvas.style.display = 'none';

        switch(tab) {
            case 'concepts':
                leftPanel.classList.add('mobile-active');
                leftPanel.style.display = 'flex';
                break;
            case 'canvas':
                mainCanvas.style.display = 'flex';
                break;
            case 'ranked':
                this.showRankedIdeas();
                mainCanvas.style.display = 'flex';
                break;
            case 'inspiration':
                rightPanel.classList.add('mobile-active');
                rightPanel.style.display = 'flex';
                break;
        }
    }
    

    // Concept Management
    async addConcept() {
        const name = prompt('Enter concept name:');
        if (!name) return;

        try {
            // Create concept in Supabase
            const { data: concept, error: conceptError } = await this.supabase
                .from('concepts')
                .insert({
            name: name.trim(),
                    user_id: this.user.id
                })
                .select()
                .single();

            if (conceptError) throw conceptError;

            // Create first session
            const { data: session, error: sessionError } = await this.supabase
                .from('sessions')
                .insert({
                    concept_id: concept.id,
                    name: 'Session 1',
                    user_id: this.user.id
                })
                .select()
                .single();

            if (sessionError) throw sessionError;

            // Add to local concepts array
            concept.sessions = [session];
            concept.currentSessionId = session.id;
        this.concepts.push(concept);

        this.renderConcepts();
        this.switchConcept(concept.id);
        } catch (error) {
            console.error('Error adding concept:', error);
            alert('Error adding concept: ' + error.message);
        }
    }

    switchConcept(conceptId) {
        this.currentConcept = this.concepts.find(c => c.id === conceptId);
        if (!this.currentConcept) return;

        // Get current session
        const currentSession = this.currentConcept.sessions.find(s => s.id === this.currentConcept.currentSessionId);
        if (!currentSession) {
            // If no current session, use the first one
            this.currentConcept.currentSessionId = this.currentConcept.sessions[0].id;
        }

        // Update UI
        document.getElementById('currentConceptTitle').textContent = this.currentConcept.name;
        this.renderBrainstormingArea();
        this.updateActiveConcept(conceptId);
        this.renderSessionSelector();
    }

    updateActiveConcept(conceptId) {
        document.querySelectorAll('.concept-item').forEach(item => {
            item.classList.toggle('active', item.dataset.conceptId === conceptId);
        });
    }

    renderConcepts() {
        const conceptList = document.getElementById('conceptList');
        if (!conceptList) {
            return;
        }
        conceptList.innerHTML = '';

        this.concepts.forEach(concept => {
            const conceptItem = document.createElement('div');
            conceptItem.className = 'concept-item';
            conceptItem.dataset.conceptId = concept.id;
            
            conceptItem.innerHTML = `
                <span class="concept-name">${concept.name}</span>
                <div class="concept-controls">
                    <button class="concept-btn delete-btn" data-concept-id="${concept.id}" title="Delete">🗑️</button>
                </div>
            `;
            
            conceptItem.addEventListener('click', (e) => {
                if (!e.target.closest('.concept-controls')) {
                    this.switchConcept(concept.id);
                }
            });
            
            // Add delete button event listener
            const deleteBtn = conceptItem.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteConcept(concept.id);
            });
            
            conceptList.appendChild(conceptItem);
        });
    }

    async deleteConcept(conceptId) {
        if (confirm('Are you sure you want to delete this concept?')) {
            try {
                // Delete all sessions for this concept from Supabase
                const { error: sessionsError } = await this.supabase
                    .from('sessions')
                    .delete()
                    .eq('concept_id', conceptId)
                    .eq('user_id', this.user.id);

                if (sessionsError) throw sessionsError;

                // Delete the concept from Supabase
                const { error: conceptError } = await this.supabase
                    .from('concepts')
                    .delete()
                    .eq('id', conceptId)
                    .eq('user_id', this.user.id);

                if (conceptError) throw conceptError;

                // Update local data
            this.concepts = this.concepts.filter(c => c.id !== conceptId);
            this.renderConcepts();
            
            if (this.currentConcept && this.currentConcept.id === conceptId) {
                this.currentConcept = null;
                document.getElementById('currentConceptTitle').textContent = 'Select a concept to start brainstorming';
                document.getElementById('brainstormingArea').innerHTML = `
                    <div class="welcome-message">
                        <p>Welcome to your brainstorming canvas!</p>
                        <p>• Press <kbd>Q</kbd> to add a new question</p>
                        <p>• Press <kbd>A</kbd> to add an answer to the selected question</p>
                        <p>• Use number keys <kbd>1-5</kbd> to color-rate answers</p>
                        <p>• Press <kbd>Ctrl+L</kbd> to toggle left panel</p>
                        <p>• Press <kbd>Ctrl+R</kbd> to toggle right panel</p>
                    </div>
                `;
            }
            
            // If there are still concepts, switch to the first one
            if (this.concepts.length > 0) {
                this.switchConcept(this.concepts[0].id);
                }
            } catch (error) {
                console.error('Error deleting concept:', error);
                alert('Error deleting concept: ' + error.message);
            }
        }
    }

    // Question Management
    addQuestion() {
        // If no concept exists, create a default one
        if (!this.currentConcept) {
            if (this.concepts.length === 0) {
                const defaultConcept = {
                    id: this.generateId(),
                    name: 'Main Canvas - Sticky Notes Variant',
                    sessions: [{
                        id: this.generateId(),
                        name: 'Session 1',
                        questions: [],
                        createdAt: new Date().toISOString()
                    }],
                    currentSessionId: null,
                    createdAt: new Date().toISOString()
                };
                defaultConcept.currentSessionId = defaultConcept.sessions[0].id;
                this.concepts.push(defaultConcept);
                this.saveConcepts();
            }
            this.switchConcept(this.concepts[0].id);
        }

        const modal = document.getElementById('addQuestionModal');
        const input = document.getElementById('questionInput');
        
        if (modal) {
            modal.classList.add('show');
            if (input) {
                input.focus();
                input.value = '';
            }
        }
    }

    async saveQuestion() {
        const input = document.getElementById('questionInput');
        const questionText = input.value.trim();
        
        if (!questionText || !this.currentConcept) return;

        const currentSession = this.currentConcept.sessions.find(s => s.id === this.currentConcept.currentSessionId);
        if (!currentSession) return;

        try {
            // Save question to Supabase
            const { data: question, error } = await this.supabase
                .from('questions')
                .insert({
                    session_id: currentSession.id,
                    text: questionText,
                    user_id: this.user.id
                })
                .select()
                .single();

            if (error) throw error;

            // Add to local data
            const localQuestion = {
                id: question.id,
            text: questionText,
            answers: [],
                createdAt: question.created_at
        };

            currentSession.questions.push(localQuestion);
        this.renderBrainstormingArea();
        this.closeModal('addQuestionModal');
        } catch (error) {
            console.error('Error saving question:', error);
            alert('Error saving question: ' + error.message);
        }
    }

    // Answer Management
    addAnswer(questionId) {
        if (!this.currentConcept) return;

        const currentSession = this.currentConcept.sessions.find(s => s.id === this.currentConcept.currentSessionId);
        if (!currentSession) return;

        const question = currentSession.questions.find(q => q.id === questionId);
        if (!question) return;

        this.selectedQuestion = question;
        
        const modal = document.getElementById('addAnswerModal');
        const input = document.getElementById('answerInput');
        const title = document.getElementById('answerQuestionTitle');
        
        title.textContent = question.text;
        modal.classList.add('show');
        input.focus();
        input.value = '';
    }

    async saveAnswer() {
        const input = document.getElementById('answerInput');
        const answerText = input.value.trim();
        
        if (!answerText || !this.selectedQuestion) return;

        try {
            // Save to Supabase (let Supabase generate the UUID)
            const { data: idea, error } = await this.supabase
                .from('ideas')
                .insert({
                    question_id: this.selectedQuestion.id,
                    text: answerText,
                    color: 'grey',
                    user_id: this.user.id
                })
                .select()
                .single();

            if (error) throw error;

            // Add to local data
        const answer = {
                id: idea.id,
            text: answerText,
            color: 'grey',
                createdAt: idea.created_at
        };

        this.selectedQuestion.answers.push(answer);
        this.renderBrainstormingArea();
        this.closeModal('addAnswerModal');
        this.selectedQuestion = null;
        } catch (error) {
            console.error('Error saving answer:', error);
            alert('Error saving idea: ' + error.message);
        }
    }

    async setAnswerColor(answerId, color) {
        if (!this.currentConcept) return;

        try {
            // Update color in Supabase
            const { error } = await this.supabase
                .from('ideas')
                .update({ color: color })
                .eq('id', answerId)
                .eq('user_id', this.user.id);

            if (error) throw error;

            // Update local data
            const currentSession = this.currentConcept.sessions.find(s => s.id === this.currentConcept.currentSessionId);
            if (currentSession) {
                for (const question of currentSession.questions) {
            const answer = question.answers.find(a => a.id === answerId);
            if (answer) {
        answer.color = color;
        break;
            }
        }
    }

            this.renderBrainstormingArea();
        } catch (error) {
            console.error('Error updating answer color:', error);
            alert('Error updating color: ' + error.message);
        }
    }

    // toggleColorDropdown function removed - using showColorDropdown instead

    // Rendering
    renderBrainstormingArea() {
        if (!this.currentConcept) return;

        const area = document.getElementById('brainstormingArea');
        const currentSession = this.currentConcept.sessions.find(s => s.id === this.currentConcept.currentSessionId);
        
        if (!currentSession || currentSession.questions.length === 0) {
            area.innerHTML = `
                <div class="welcome-message">
                    <p>No questions yet for "${this.currentConcept.name}"</p>
                    <p>Press <kbd>Q</kbd> to add your first question</p>
                </div>
            `;
            return;
        }

        console.log('Rendering brainstorming area with', currentSession.questions.length, 'questions');
        
        const html = currentSession.questions.map(question => 
            this.renderQuestion(question)
        ).join('');
        
        console.log('Generated HTML:', html);
        area.innerHTML = html;
        
        // Check if color circles exist after insertion
        setTimeout(() => {
            const circles = area.querySelectorAll('.color-circle');
            console.log('Found', circles.length, 'color circles in DOM');
        }, 100);
    }

    renderQuestion(question) {
        console.log('Rendering question:', question.text, 'with', question.answers.length, 'answers');
        const filteredAnswers = question.answers.filter(answer => this.shouldShowAnswer(answer));
        console.log('Filtered answers:', filteredAnswers.length);
        const answersHtml = filteredAnswers
            .map((answer, index) => this.renderAnswer(answer, index + 1))
            .join('');
        console.log('Generated answers HTML length:', answersHtml.length);

        const isMobile = window.innerWidth <= 480;
        
        if (isMobile) {
            // Mobile design: Q prefix, answers above button
            return `
                <div class="question-block">
                    <div class="question-header">
                        <div class="question-prefix">Q</div>
                        <div class="question-title" ondblclick="app.editQuestion('${question.id}')">
                            ${question.text}
                        </div>
                        <button class="delete-question-btn" onclick="event.stopPropagation(); app.deleteQuestion('${question.id}')" title="Delete question">×</button>
                    </div>
                    <div class="answers-container" data-question-id="${question.id}">
                        ${answersHtml}
                    </div>
                        <button class="add-answer-btn" onclick="event.stopPropagation(); app.addAnswer('${question.id}')">
                        + Add idea...
                        </button>
                </div>
            `;
        } else {
            // Desktop design - clean vertical layout
            return `
                <div class="question-block">
                    <div class="question-header">
                        <div class="question-prefix">Q</div>
                        <div class="question-title" ondblclick="app.editQuestion('${question.id}')">${question.text}</div>
                        <button class="delete-question-btn" onclick="event.stopPropagation(); app.deleteQuestion('${question.id}')" title="Delete question">×</button>
                    </div>
                    <div class="answers-container" data-question-id="${question.id}">
                        ${answersHtml}
                    </div>
                    <button class="add-answer-btn" onclick="event.stopPropagation(); app.addAnswer('${question.id}')">
                        + Add idea...
                    </button>
                </div>
            `;
        }
    }

    renderAnswer(answer, number) {
        console.log('Rendering answer:', answer.text, 'window.innerWidth:', window.innerWidth, 'isMobile:', window.innerWidth <= 480);
        // More reliable mobile detection
        const isMobile = window.innerWidth <= 480 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
            console.log('Taking MOBILE code path');
            // Mobile: Small number, full-width text, 1 colored dot with dropdown
            const isLongText = answer.text.length > 50;
            const contentClass = isLongText ? 'answer-content truncated' : 'answer-content';
            
            return `
                <div class="answer-item color-${answer.color || 'grey'}" data-answer-id="${answer.id}">
                    <div class="answer-number">${number}</div>
                    <div class="${contentClass}" onclick="app.toggleAnswerExpansion('${answer.id}'); app.showDeleteButton('${answer.id}')" ondblclick="app.editAnswer('${answer.id}')" data-full-text="${answer.text}">${answer.text}</div>
                    <div class="answer-controls-mobile" style="display: flex !important; align-items: center !important; gap: 8px !important; position: relative !important;">
                        <div class="answer-color-dot color-${answer.color || 'grey'}" onclick="console.log('Dot clicked!'); app.showColorDropdown('${answer.id}')" style="width: 14px !important; height: 14px !important; border-radius: 50% !important; border: 2px solid var(--bg-secondary) !important; background: ${answer.color === 'grey' ? '#6c757d' : answer.color === 'yellow' ? '#ffc107' : answer.color === 'blue' ? '#007bff' : answer.color === 'purple' ? '#6f42c1' : answer.color === 'green' ? '#28a745' : '#6c757d'} !important; display: block !important; visibility: visible !important; cursor: pointer !important;"></div>
                        <button class="delete-answer-btn hidden" onclick="event.stopPropagation(); app.deleteAnswer('${answer.id}')" title="Delete idea">×</button>
                    <div class="color-dropdown" id="colorDropdown-${answer.id}">
                            <div class="color-option color-grey">Trash</div>
                            <div class="color-option color-yellow">Maybe</div>
                            <div class="color-option color-blue">Decent</div>
                            <div class="color-option color-purple">Strong</div>
                            <div class="color-option color-green">Keeper</div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            console.log('Taking DESKTOP code path');
            // Desktop: 5 separate color circles
            const isLongText = answer.text.length > 50;
            const contentClass = isLongText ? 'answer-content truncated' : 'answer-content';
            
            const html = `
                <div class="answer-item ${answer.color ? `color-${answer.color}` : ''}" data-answer-id="${answer.id}">
                    <div class="answer-number">${number}</div>
                    <div class="${contentClass}" onclick="app.toggleAnswerExpansion('${answer.id}')" ondblclick="app.editAnswer('${answer.id}')" data-full-text="${answer.text}">${answer.text}</div>
                    <div class="answer-controls" style="display: flex !important; gap: 5px !important; flex-shrink: 0 !important; align-items: center !important;">
                        <div class="color-circles" style="display: flex !important; gap: 6px !important; align-items: center !important;">
                            <div class="color-circle color-grey ${answer.color === 'grey' ? 'active' : ''}" onclick="app.colorAnswer('${answer.id}', 'grey')" title="Trash" style="width: 16px !important; height: 16px !important; border-radius: 50% !important; border: 2px solid var(--border-color) !important; background: #6c757d !important; display: block !important; visibility: visible !important; cursor: pointer !important; opacity: ${answer.color === 'grey' ? '1' : '0.6'} !important;"></div>
                            <div class="color-circle color-yellow ${answer.color === 'yellow' ? 'active' : ''}" onclick="app.colorAnswer('${answer.id}', 'yellow')" title="Maybe" style="width: 16px !important; height: 16px !important; border-radius: 50% !important; border: 2px solid var(--border-color) !important; background: #ffc107 !important; display: block !important; visibility: visible !important; cursor: pointer !important; opacity: ${answer.color === 'yellow' ? '1' : '0.6'} !important;"></div>
                            <div class="color-circle color-blue ${answer.color === 'blue' ? 'active' : ''}" onclick="app.colorAnswer('${answer.id}', 'blue')" title="Decent" style="width: 16px !important; height: 16px !important; border-radius: 50% !important; border: 2px solid var(--border-color) !important; background: #007bff !important; display: block !important; visibility: visible !important; cursor: pointer !important; opacity: ${answer.color === 'blue' ? '1' : '0.6'} !important;"></div>
                            <div class="color-circle color-purple ${answer.color === 'purple' ? 'active' : ''}" onclick="app.colorAnswer('${answer.id}', 'purple')" title="Strong" style="width: 16px !important; height: 16px !important; border-radius: 50% !important; border: 2px solid var(--border-color) !important; background: #6f42c1 !important; display: block !important; visibility: visible !important; cursor: pointer !important; opacity: ${answer.color === 'purple' ? '1' : '0.6'} !important;"></div>
                            <div class="color-circle color-green ${answer.color === 'green' ? 'active' : ''}" onclick="app.colorAnswer('${answer.id}', 'green')" title="Keeper" style="width: 16px !important; height: 16px !important; border-radius: 50% !important; border: 2px solid var(--border-color) !important; background: #28a745 !important; display: block !important; visibility: visible !important; cursor: pointer !important; opacity: ${answer.color === 'green' ? '1' : '0.6'} !important;"></div>
                        </div>
                        <button class="delete-answer-btn" onclick="event.stopPropagation(); app.deleteAnswer('${answer.id}')" title="Delete idea">×</button>
                    </div>
                </div>
            `;
            console.log('Desktop HTML generated:', html);
            return html;
        }
    }

    getColorLabel(color) {
        const labels = {
            grey: 'Trash',
            yellow: 'Maybe',
            blue: 'Decent',
            purple: 'Strong',
            green: 'Keeper'
        };
        return labels[color] || color;
    }

    shouldShowAnswer(answer) {
        if (this.currentFilter === 'all') return true;
        return answer.color === this.currentFilter;
    }

    // UI Interactions
    toggleQuestion(questionId) {
        const answersContainer = document.querySelector(`[data-question-id="${questionId}"]`);
        const expandBtn = document.querySelector(`[data-question-id="${questionId}"] .expand-btn`);
        
        if (answersContainer && expandBtn) {
            answersContainer.classList.toggle('collapsed');
            const isCollapsed = answersContainer.classList.contains('collapsed');
            expandBtn.textContent = isCollapsed ? '▶' : '▼';
        }
    }

    togglePanel(panelId) {
        const panel = document.getElementById(panelId);
        panel.classList.toggle('collapsed');
    }

    setupInspirationTabs() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.tab;
                
                // Update active tab button
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Update active tab content
                tabContents.forEach(content => {
                    content.classList.remove('active');
                    if (content.id === tabName + 'Tab') {
                        content.classList.add('active');
                    }
                });
            });
        });

        // Inspiration item clicks
        document.querySelectorAll('.inspiration-item').forEach(item => {
            item.addEventListener('click', () => {
                const type = item.dataset.type;
                const text = item.textContent;
                
                if (type === 'question') {
                    // Check if it's a custom question type
                    if (text.includes('Questions') || text.includes('Possibilities') || text.includes('Details') || 
                        text.includes('Consequence') || text.includes('Reversal') || text.includes('Perspective') ||
                        text.includes('Exaggeration') || text.includes('Combination') || text.includes('Restriction') ||
                        text.includes('Removal') || text.includes('"But"')) {
                        this.toggleQuestionTypeExamples(item);
                    } else {
                    this.addQuestionFromInspiration(text);
                    }
                } else if (type === 'prompt') {
                    this.addAnswerFromInspiration(text);
                } else if (type === 'word') {
                    this.addAnswerFromInspiration(`Use "${text}" as inspiration`);
                }
            });
        });
    }

    async addQuestionFromInspiration(text) {
        if (!this.currentConcept) {
            alert('Please select a concept first');
            return;
        }

        const currentSession = this.currentConcept.sessions.find(s => s.id === this.currentConcept.currentSessionId);
        if (!currentSession) return;

        try {
            // Save question to Supabase
            const { data: question, error } = await this.supabase
                .from('questions')
                .insert({
                    session_id: currentSession.id,
                    text: text,
                    user_id: this.user.id
                })
                .select()
                .single();

            if (error) throw error;

            // Add to local data
            const localQuestion = {
                id: question.id,
            text: text,
            answers: [],
                createdAt: question.created_at
        };

            currentSession.questions.push(localQuestion);
        this.renderBrainstormingArea();
        } catch (error) {
            console.error('Error saving question from inspiration:', error);
            alert('Error saving question: ' + error.message);
        }
    }

    toggleQuestionTypeExamples(item) {
        const type = item.textContent;
        const examplesContainer = item.querySelector('.question-examples');
        
        if (examplesContainer) {
            // Toggle existing examples
            examplesContainer.classList.toggle('hidden');
        } else {
            // Create and show examples
            const examples = this.getQuestionTypeExamples(type);
            const examplesDiv = document.createElement('div');
            examplesDiv.className = 'question-examples';
            
            examples.forEach(example => {
                const exampleItem = document.createElement('div');
                exampleItem.className = 'inspiration-item example-item';
                exampleItem.textContent = example;
                exampleItem.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.addQuestionFromInspiration(example);
                });
                examplesDiv.appendChild(exampleItem);
            });
            
            item.appendChild(examplesDiv);
        }
    }

    getQuestionTypeExamples(type) {
        const questionTemplates = {
            'Hypothetical Questions': [
                "What's the weirdest way _______ could happen?",
                "What if _______?",
                "How would the world change if _______?",
                "What if it's not the first time _______?"
            ],
            'Alternate Possibilities': [
                "Can this happen in any other way?",
                "What's another reason this could happen?",
                "If this event didn't happen, what could take its place?",
                "What's a completely different approach to _______?"
            ],
            'Tweaking Small Details': [
                "What's the smallest change that could completely alter _______?",
                "How would this story change if the setting was different?",
                "What if this took place 100 years in the past/future?",
                "How would _______ change if one small detail was different?"
            ],
            'Consequence-Based': [
                "What happens after _______?",
                "What's the worst/best outcome of _______?",
                "How could _______ lead to something unexpected?",
                "What are the long-term effects of _______?"
            ],
            'Reversal Questions': [
                "What if the opposite of _______ happened?",
                "How would this story change if the hero was the villain?",
                "What if the problem was actually the solution?",
                "What if we did the exact opposite of _______?"
            ],
            'Perspective-Shifting': [
                "How would a child/animal/robot experience _______?",
                "What would an outsider think about _______?",
                "How would a character who believes the exact opposite react to _______?",
                "What would _______ look like from a different perspective?"
            ],
            'Exaggeration & Absurdity': [
                "What's the most ridiculous version of _______?",
                "What if everything about _______ was twice as big/small/fast/slow?",
                "What's the dumbest way _______ could go wrong?",
                "What if _______ was taken to the extreme?"
            ],
            'Combination Questions': [
                "What if _______ and _______ were combined?",
                "What happens when a _______ meets a _______?",
                "What's an unusual way to solve _______?",
                "How could we combine _______ with something unexpected?"
            ],
            'Restriction Questions': [
                "How would you tell this story without using dialogue?",
                "What if the main character could only communicate in gestures?",
                "How would this play out if it had to happen in 60 seconds?",
                "What if _______ had to work with severe limitations?"
            ],
            'Removal Questions': [
                "What if _______ was removed from the world?",
                "How would this work without _______?",
                "What happens if the main character loses their main ability?",
                "What if we took away _______ from this situation?"
            ],
            '"But" Questions': [
                "What if _______ but they didn't want it?",
                "What if _______ but it made things worse?",
                "What if _______ but no one believed them?",
                "What if _______ but it was already too late?",
                "What if _______ but they were lying?"
            ]
        };

        return questionTemplates[type] || [];
    }

    async addAnswerFromInspiration(text) {
        if (!this.selectedQuestion) {
            alert('Please select a question first by clicking on it');
            return;
        }

        try {
            // Save to Supabase
            const { data: idea, error } = await this.supabase
                .from('ideas')
                .insert({
                    question_id: this.selectedQuestion.id,
                    text: text,
                    color: 'grey',
                    user_id: this.user.id
                })
                .select()
                .single();

            if (error) throw error;

            // Add to local data
        const answer = {
                id: idea.id,
            text: text,
            color: 'grey',
                createdAt: idea.created_at
        };

        this.selectedQuestion.answers.push(answer);
        this.renderBrainstormingArea();
        } catch (error) {
            console.error('Error saving answer from inspiration:', error);
            alert('Error saving idea: ' + error.message);
        }
    }

    async deleteQuestion(questionId) {
        if (!this.currentConcept) return;
        
        const currentSession = this.currentConcept.sessions.find(s => s.id === this.currentConcept.currentSessionId);
        if (!currentSession) return;
        
        if (confirm('Are you sure you want to delete this question and all its ideas?')) {
            try {
                // First delete all ideas for this question from Supabase
                const { error: ideasError } = await this.supabase
                    .from('ideas')
                    .delete()
                    .eq('question_id', questionId)
                    .eq('user_id', this.user.id);

                if (ideasError) throw ideasError;

                // Then delete the question from Supabase
                const { error: questionError } = await this.supabase
                    .from('questions')
                    .delete()
                    .eq('id', questionId)
                    .eq('user_id', this.user.id);

                if (questionError) throw questionError;

                // Update local data
                currentSession.questions = currentSession.questions.filter(q => q.id !== questionId);
                
                this.renderBrainstormingArea();
            } catch (error) {
                console.error('Error deleting question:', error);
                alert('Error deleting question: ' + error.message);
            }
        }
    }

    async deleteAnswer(answerId) {
        if (!this.currentConcept) return;
        
        const currentSession = this.currentConcept.sessions.find(s => s.id === this.currentConcept.currentSessionId);
        if (!currentSession) return;
        
        if (confirm('Are you sure you want to delete this idea?')) {
            try {
                // Delete from Supabase
                const { error } = await this.supabase
                    .from('ideas')
                    .delete()
                    .eq('id', answerId)
                    .eq('user_id', this.user.id);

                if (error) throw error;

                // Update local data
                currentSession.questions.forEach(question => {
                    question.answers = question.answers.filter(a => a.id !== answerId);
                });
                
                this.renderBrainstormingArea();
            } catch (error) {
                console.error('Error deleting answer:', error);
                alert('Error deleting idea: ' + error.message);
            }
        }
    }

    toggleAnswerExpansion(answerId) {
        const contentElement = document.querySelector(`[data-answer-id="${answerId}"] .answer-content`);
        if (!contentElement) return;

        const isExpanded = contentElement.classList.contains('expanded');
        
        if (isExpanded) {
            // Collapse
            contentElement.classList.remove('expanded');
            contentElement.classList.add('truncated');
        } else {
            // Expand
            contentElement.classList.remove('truncated');
            contentElement.classList.add('expanded');
        }
    }

    showDeleteButton(answerId) {
        // Hide all other delete buttons
        document.querySelectorAll('.delete-answer-btn').forEach(btn => {
            btn.classList.add('hidden');
        });
        
        // Show this delete button
        const deleteBtn = document.querySelector(`[data-answer-id="${answerId}"] .delete-answer-btn`);
        if (deleteBtn) {
            deleteBtn.classList.remove('hidden');
        }
    }

    setupRandomWords() {
        const randomWords = [
            'Elephant', 'Cloud', 'Mirror', 'Clock', 'Bridge', 'Key', 'Lightning', 'Maze', 'Rocket', 'Puzzle',
            'Ocean', 'Mountain', 'Fire', 'Ice', 'Wind', 'Earth', 'Star', 'Moon', 'Sun', 'Rain',
            'Tree', 'Flower', 'Bird', 'Fish', 'Lion', 'Tiger', 'Bear', 'Wolf', 'Eagle', 'Butterfly',
            'Book', 'Pen', 'Paper', 'Computer', 'Phone', 'Camera', 'Car', 'Bike', 'Plane', 'Ship',
            'House', 'Door', 'Window', 'Garden', 'Kitchen', 'Bedroom', 'Library', 'Museum', 'Park', 'Beach'
        ];

        const randomizeBtn = document.getElementById('randomizeWords');
        if (randomizeBtn) {
            randomizeBtn.addEventListener('click', () => {
            const wordList = document.querySelector('#wordsTab .inspiration-list');
                if (wordList) {
            const shuffled = [...randomWords].sort(() => Math.random() - 0.5);
            
            wordList.innerHTML = shuffled.slice(0, 10).map(word => 
                `<div class="inspiration-item" data-type="word">${word}</div>`
            ).join('');

            // Re-attach event listeners
            wordList.querySelectorAll('.inspiration-item').forEach(item => {
                item.addEventListener('click', () => {
                    this.addAnswerFromInspiration(`Use "${item.textContent}" as inspiration`);
                });
            });
                }
        });
        }
    }

    // Filtering
    setupFiltering() {
        const filterBtn = document.getElementById('filterBtn');
        const filterDropdown = document.getElementById('filterDropdown');

        if (filterBtn && filterDropdown) {
        filterBtn.addEventListener('click', () => {
            filterDropdown.style.display = filterDropdown.style.display === 'none' ? 'block' : 'none';
        });

        filterDropdown.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                const filter = e.target.dataset.filter;
                this.setFilter(filter);
                filterDropdown.style.display = 'none';
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!filterBtn.contains(e.target) && !filterDropdown.contains(e.target)) {
                filterDropdown.style.display = 'none';
            }
        });
        }
    }

    setFilter(filter) {
        this.currentFilter = filter;
        this.renderBrainstormingArea();
        
        // Update filter button text
        const filterBtn = document.getElementById('filterBtn');
        if (filterBtn) {
        const filterLabels = {
            all: 'All Ideas',
            grey: 'Grey (Trash)',
            yellow: 'Yellow (Maybe)',
            blue: 'Blue (Decent)',
            purple: 'Purple (Strong)',
            green: 'Green (Keeper)'
        };
        filterBtn.textContent = filterLabels[filter] || 'Filter';
        }
    }

    // Modal Management
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.remove('show');
    }

    // Keyboard Shortcuts
    setupKeyboardShortcuts() {
        console.log('Setting up keyboard shortcuts');
        document.addEventListener('keydown', (e) => {
            // Prevent shortcuts when typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                if (e.key === 'Enter' && e.ctrlKey) {
                    if (e.target.id === 'questionInput') {
                        this.saveQuestion();
                    } else if (e.target.id === 'answerInput') {
                        this.saveAnswer();
                    }
                }
                return;
            }

            // Global shortcuts
            switch (e.key.toLowerCase()) {
                case 'q':
                    console.log('Q key pressed');
                    e.preventDefault();
                    e.stopPropagation();
                    this.addQuestion();
                    break;
                case 'a':
                    e.preventDefault();
                    if (this.selectedQuestion) {
                        this.addAnswer(this.selectedQuestion.id);
                    } else {
                        alert('Please select a question first');
                    }
                    break;
                case '1':
                case '2':
                case '3':
                case '4':
                case '5':
                    e.preventDefault();
                    this.setSelectedAnswerColor(e.key);
                    break;
            }

            // Panel toggles
            if (e.ctrlKey) {
                switch (e.key.toLowerCase()) {
                    case 'l':
                        e.preventDefault();
                        this.togglePanel('leftPanel');
                        break;
                    case 'r':
                        e.preventDefault();
                        this.togglePanel('rightPanel');
                        break;
                }
            }
        });
    }

    setSelectedAnswerColor(number) {
        // This would need to be implemented with a selection system
        // For now, we'll just show a message
        const colors = ['', 'grey', 'yellow', 'blue', 'purple', 'green'];
        const color = colors[parseInt(number)];
        if (color) {
            console.log(`Would set selected answer to ${color}`);
        }
    }

    // Event Listeners
    setupEventListeners() {
        // Panel toggles
        const toggleLeft = document.getElementById('toggleLeft');
        if (toggleLeft) {
            toggleLeft.addEventListener('click', () => {
            this.togglePanel('leftPanel');
        });
        }

        const toggleRight = document.getElementById('toggleRight');
        if (toggleRight) {
            toggleRight.addEventListener('click', () => {
            this.togglePanel('rightPanel');
        });
        }

        // Add concept button
        const addConceptBtn = document.getElementById('addConceptBtn');
        if (addConceptBtn) {
            addConceptBtn.addEventListener('click', () => {
            this.addConcept();
        });
        }


        // Modal events
        const saveQuestionBtn = document.getElementById('saveQuestion');
        if (saveQuestionBtn) {
            saveQuestionBtn.addEventListener('click', () => {
            this.saveQuestion();
        });
        }

        const cancelQuestionBtn = document.getElementById('cancelQuestion');
        if (cancelQuestionBtn) {
            cancelQuestionBtn.addEventListener('click', () => {
            this.closeModal('addQuestionModal');
        });
        }

        const saveAnswerBtn = document.getElementById('saveAnswer');
        if (saveAnswerBtn) {
            saveAnswerBtn.addEventListener('click', () => {
            this.saveAnswer();
        });
        }

        const cancelAnswerBtn = document.getElementById('cancelAnswer');
        if (cancelAnswerBtn) {
            cancelAnswerBtn.addEventListener('click', () => {
            this.closeModal('addAnswerModal');
        });
        }

        // Modal input events
        const questionInput = document.getElementById('questionInput');
        if (questionInput) {
            questionInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.saveQuestion();
            } else if (e.key === 'Escape') {
                this.closeModal('addQuestionModal');
            }
        });
        }

        const answerInput = document.getElementById('answerInput');
        if (answerInput) {
            answerInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal('addAnswerModal');
            }
        });
        }

        // Setup filtering
        this.setupFiltering();

        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
            this.toggleTheme();
        });
        }

        // Mobile navigation
        this.setupMobileNavigation();

        // Floating action button
        const fab = document.getElementById('fab');
        if (fab) {
            fab.addEventListener('click', () => {
            this.addQuestion();
        });
        }

        // Duplicate click outside handler removed - using setupClickOutsideDropdowns instead
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
const app = new BrainstormingApp();
    // Make app globally available for debugging
    window.app = app;
});
