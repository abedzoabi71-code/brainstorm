// Brainstorming Canvas Application
class BrainstormingApp {
    constructor() {
        this.currentConcept = null;
        this.concepts = this.loadConcepts();
        this.selectedQuestion = null;
        this.currentFilter = 'all';
        this.isDarkMode = this.loadTheme();
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.renderConcepts();
        this.setupKeyboardShortcuts();
        this.setupInspirationTabs();
        this.setupRandomWords();
        this.applyTheme();
        this.setupAddQuestionButton();
        this.setupClickOutsideDropdowns();
        this.setupMobileNavigation();
        this.setupAutoCleanup();
        
        // Load first concept if available
        if (this.concepts.length > 0) {
            this.switchConcept(this.concepts[0].id);
        } else {
            // Ensure we have at least one concept
            this.loadConcepts();
            this.renderConcepts();
            if (this.concepts.length > 0) {
                this.switchConcept(this.concepts[0].id);
            }
        }
    }

    // Data Management
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
        // Hide all other dropdowns
        document.querySelectorAll('.color-dropdown').forEach(dropdown => {
            dropdown.classList.remove('show');
        });
        
        // Show this dropdown
        const dropdown = document.getElementById(`colorDropdown-${answerId}`);
        if (dropdown) {
            dropdown.classList.add('show');
        }
    }

    colorAnswer(answerId, color) {
        // Hide dropdown
        document.querySelectorAll('.color-dropdown').forEach(dropdown => {
            dropdown.classList.remove('show');
        });
        
        // Update answer color
        const answer = this.currentConcept.questions
            .flatMap(q => q.answers)
            .find(a => a.id === answerId);
        
        if (answer) {
            answer.color = color;
            this.renderBrainstormingArea();
        }
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
            // Close color dropdowns
            if (!e.target.closest('.answer-color-dot') && !e.target.closest('.color-dropdown')) {
                document.querySelectorAll('.color-dropdown').forEach(dropdown => {
                    dropdown.classList.remove('show');
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
            this.cleanupGreyIdeas();
        });

        // Also clean up on page visibility change (when switching tabs)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.cleanupGreyIdeas();
            }
        });
    }

    cleanupGreyIdeas() {
        let hasChanges = false;
        
        if (!this.concepts || this.concepts.length === 0) return;
        
        this.concepts.forEach(concept => {
            if (!concept.sessions || concept.sessions.length === 0) return;
            
            concept.sessions.forEach(session => {
                if (!session.questions || session.questions.length === 0) return;
                
                const originalLength = session.questions.length;
                session.questions = session.questions.filter(question => {
                    if (!question.answers || question.answers.length === 0) return false;
                    
                    const originalAnswersLength = question.answers.length;
                    question.answers = question.answers.filter(answer => answer.color !== 'grey');
                    if (question.answers.length !== originalAnswersLength) {
                        hasChanges = true;
                    }
                    return question.answers.length > 0; // Remove questions with no answers
                });
                if (session.questions.length !== originalLength) {
                    hasChanges = true;
                }
            });
        });

        if (hasChanges) {
            this.saveConcepts();
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
    addConcept() {
        const name = prompt('Enter concept name:');
        if (!name) return;

        const concept = {
            id: this.generateId(),
            name: name.trim(),
            sessions: [{
                id: this.generateId(),
                name: 'Session 1',
                questions: [],
                createdAt: new Date().toISOString()
            }],
            currentSessionId: null,
            createdAt: new Date().toISOString()
        };
        concept.currentSessionId = concept.sessions[0].id;

        this.concepts.push(concept);
        this.saveConcepts();
        this.renderConcepts();
        this.switchConcept(concept.id);
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

    deleteConcept(conceptId) {
        if (confirm('Are you sure you want to delete this concept?')) {
            this.concepts = this.concepts.filter(c => c.id !== conceptId);
            this.saveConcepts();
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

    saveQuestion() {
        const input = document.getElementById('questionInput');
        const questionText = input.value.trim();
        
        if (!questionText || !this.currentConcept) return;

        const currentSession = this.currentConcept.sessions.find(s => s.id === this.currentConcept.currentSessionId);
        if (!currentSession) return;

        const question = {
            id: this.generateId(),
            text: questionText,
            answers: [],
            createdAt: new Date().toISOString()
        };

        currentSession.questions.push(question);
        this.saveConcepts();
        this.renderBrainstormingArea();
        this.closeModal('addQuestionModal');
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

    saveAnswer() {
        const input = document.getElementById('answerInput');
        const answerText = input.value.trim();
        
        if (!answerText || !this.selectedQuestion) return;

        const answer = {
            id: this.generateId(),
            text: answerText,
            color: 'grey',
            createdAt: new Date().toISOString()
        };

        this.selectedQuestion.answers.push(answer);
        this.saveConcepts();
        this.renderBrainstormingArea();
        this.closeModal('addAnswerModal');
        this.selectedQuestion = null;
    }

    setAnswerColor(answerId, color) {
        if (!this.currentConcept) return;

        const currentSession = this.currentConcept.sessions.find(s => s.id === this.currentConcept.currentSessionId);
        if (!currentSession) return;

        for (const question of currentSession.questions) {
            const answer = question.answers.find(a => a.id === answerId);
            if (answer) {
                answer.color = color;
                this.saveConcepts();
                this.renderBrainstormingArea();
                break;
            }
        }
    }

    toggleColorDropdown(answerId) {
        const dropdown = document.getElementById(`colorDropdown-${answerId}`);
        if (dropdown) {
            // Close all other dropdowns
            document.querySelectorAll('.color-dropdown').forEach(dd => {
                if (dd.id !== `colorDropdown-${answerId}`) {
                    dd.style.display = 'none';
                }
            });
            
            // Toggle current dropdown
            dropdown.style.display = dropdown.style.display === 'none' ? 'flex' : 'none';
        }
    }

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

        area.innerHTML = currentSession.questions.map(question => 
            this.renderQuestion(question)
        ).join('');
    }

    renderQuestion(question) {
        const answersHtml = question.answers
            .filter(answer => this.shouldShowAnswer(answer))
            .map((answer, index) => this.renderAnswer(answer, index + 1))
            .join('');

        const isMobile = window.innerWidth <= 480;
        
        if (isMobile) {
            // Mobile design: Q prefix, answers above button
            return `
                <div class="question-block">
                    <div class="question-header">
                        <div class="question-prefix">Q</div>
                        <div class="question-title">
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
                        <div class="question-title">${question.text}</div>
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
        const isMobile = window.innerWidth <= 480;
        
        if (isMobile) {
            // Mobile: Small number, full-width text, colored dot with dropdown
            const isLongText = answer.text.length > 50;
            const contentClass = isLongText ? 'answer-content truncated' : 'answer-content';
            
            return `
                <div class="answer-item color-${answer.color || 'grey'}" data-answer-id="${answer.id}">
                    <div class="answer-number">${number}</div>
                    <div class="${contentClass}" onclick="app.toggleAnswerExpansion('${answer.id}'); app.showDeleteButton('${answer.id}')" data-full-text="${answer.text}">${answer.text}</div>
                    <div class="answer-color-dot color-${answer.color || 'grey'}" onclick="app.showColorDropdown('${answer.id}')"></div>
                    <button class="delete-answer-btn hidden" onclick="event.stopPropagation(); app.deleteAnswer('${answer.id}')" title="Delete idea">×</button>
                    <div class="color-dropdown" id="colorDropdown-${answer.id}">
                        <div class="color-option color-grey" onclick="app.colorAnswer('${answer.id}', 'grey')"></div>
                        <div class="color-option color-yellow" onclick="app.colorAnswer('${answer.id}', 'yellow')"></div>
                        <div class="color-option color-blue" onclick="app.colorAnswer('${answer.id}', 'blue')"></div>
                        <div class="color-option color-purple" onclick="app.colorAnswer('${answer.id}', 'purple')"></div>
                        <div class="color-option color-green" onclick="app.colorAnswer('${answer.id}', 'green')"></div>
                    </div>
                </div>
            `;
        } else {
            // Desktop: Single color dot with dropdown
            const isLongText = answer.text.length > 50;
            const contentClass = isLongText ? 'answer-content truncated' : 'answer-content';
            
            return `
                <div class="answer-item ${answer.color ? `color-${answer.color}` : ''}" data-answer-id="${answer.id}">
                    <div class="answer-number">${number}</div>
                    <div class="${contentClass}" onclick="app.toggleAnswerExpansion('${answer.id}')" data-full-text="${answer.text}">${answer.text}</div>
                    <div class="answer-controls">
                        <div class="answer-color-dot color-${answer.color || 'grey'}" onclick="app.showColorDropdown('${answer.id}')"></div>
                        <button class="delete-answer-btn" onclick="event.stopPropagation(); app.deleteAnswer('${answer.id}')" title="Delete idea">×</button>
                        <div class="color-dropdown" id="colorDropdown-${answer.id}">
                            <div class="color-option color-grey" onclick="app.colorAnswer('${answer.id}', 'grey')"></div>
                            <div class="color-option color-yellow" onclick="app.colorAnswer('${answer.id}', 'yellow')"></div>
                            <div class="color-option color-blue" onclick="app.colorAnswer('${answer.id}', 'blue')"></div>
                            <div class="color-option color-purple" onclick="app.colorAnswer('${answer.id}', 'purple')"></div>
                            <div class="color-option color-green" onclick="app.colorAnswer('${answer.id}', 'green')"></div>
                        </div>
                    </div>
                </div>
            `;
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

    addQuestionFromInspiration(text) {
        if (!this.currentConcept) {
            alert('Please select a concept first');
            return;
        }

        const currentSession = this.currentConcept.sessions.find(s => s.id === this.currentConcept.currentSessionId);
        if (!currentSession) return;

        const question = {
            id: this.generateId(),
            text: text,
            answers: [],
            createdAt: new Date().toISOString()
        };

        currentSession.questions.push(question);
        this.saveConcepts();
        this.renderBrainstormingArea();
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

    addAnswerFromInspiration(text) {
        if (!this.selectedQuestion) {
            alert('Please select a question first by clicking on it');
            return;
        }
        
        const answer = {
            id: this.generateId(),
            text: text,
            color: 'grey',
            createdAt: new Date().toISOString()
        };
        
        this.selectedQuestion.answers.push(answer);
        this.saveConcepts();
        this.renderBrainstormingArea();
    }

    deleteQuestion(questionId) {
        if (!this.currentConcept) return;
        
        const currentSession = this.currentConcept.sessions.find(s => s.id === this.currentConcept.currentSessionId);
        if (!currentSession) return;
        
        if (confirm('Are you sure you want to delete this question and all its ideas?')) {
            currentSession.questions = currentSession.questions.filter(q => q.id !== questionId);
            this.saveConcepts();
            this.renderBrainstormingArea();
        }
    }

    deleteAnswer(answerId) {
        if (!this.currentConcept) return;
        
        const currentSession = this.currentConcept.sessions.find(s => s.id === this.currentConcept.currentSessionId);
        if (!currentSession) return;
        
        if (confirm('Are you sure you want to delete this idea?')) {
            currentSession.questions.forEach(question => {
                question.answers = question.answers.filter(a => a.id !== answerId);
            });
            this.saveConcepts();
            this.renderBrainstormingArea();
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

    showColorDropdown(answerId) {
        // Hide all other dropdowns
        document.querySelectorAll('.color-dropdown').forEach(dropdown => {
            dropdown.classList.remove('show');
        });
        
        // Show this dropdown
        const dropdown = document.getElementById(`colorDropdown-${answerId}`);
        if (dropdown) {
            dropdown.classList.add('show');
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

        // Close color dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.color-dropdown-container')) {
                document.querySelectorAll('.color-dropdown').forEach(dropdown => {
                    dropdown.style.display = 'none';
                });
            }
        });
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new BrainstormingApp();
    // Make app globally available for debugging
    window.app = app;
});