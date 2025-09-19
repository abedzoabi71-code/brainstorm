# Brainstorming Canvas

A modern, feature-rich brainstorming website designed to help you organize and develop your ideas effectively.

## Features

### Layout
- **Left Panel (Collapsible)**: Manage your concepts and ideas
- **Right Panel (Collapsible)**: Access inspiration tabs with questions, prompts, and random words
- **Main Canvas**: Notes app-style interface for brainstorming

### Core Functionality
- **Concept Management**: Create, switch between, and delete different brainstorming concepts
- **Question & Answer System**: Add questions and numbered answers like a structured notes app
- **Color Rating System**: Rate your ideas with 5 color levels:
  - 🔘 Grey = Trash
  - 🟡 Yellow = Maybe  
  - 🔵 Blue = Decent
  - 🟣 Purple = Strong
  - 🟢 Green = Keeper

### Advanced Features
- **Collapse/Expand**: Hide answers and panels to keep the interface uncluttered
- **Session Management**: Each concept maintains its own set of questions and answers
- **Filtering**: Show only ideas with specific color ratings
- **Inspiration Tools**: 
  - Question types to spark ideas
  - Creative prompts for different thinking approaches
  - Random words and props for lateral thinking
- **Keyboard Shortcuts**: Fast operations for power users

## Keyboard Shortcuts

- **Q**: Add a new question
- **A**: Add an answer to the selected question
- **1-5**: Set answer color rating (1=Grey, 2=Yellow, 3=Blue, 4=Purple, 5=Green)
- **Ctrl+L**: Toggle left panel
- **Ctrl+R**: Toggle right panel
- **Enter**: Save when in modal inputs
- **Escape**: Cancel modal dialogs

## How to Use

1. **Start**: Open `index.html` in your web browser
2. **Create a Concept**: Click "+ Add New Concept" in the left panel
3. **Add Questions**: Press Q or click "Add Question" to start brainstorming
4. **Add Answers**: Click on a question, then press A or click "+ Add Answer"
5. **Rate Ideas**: Click the color dots next to each answer to rate them
6. **Get Inspired**: Use the right panel tabs for inspiration
7. **Filter**: Use the Filter button to show only specific color ratings
8. **Organize**: Collapse panels and questions to focus on what matters

## Technical Details

- **Storage**: All data is saved locally in your browser using localStorage
- **Responsive**: Works on desktop, tablet, and mobile devices
- **Modern Design**: Clean, intuitive interface inspired by modern note-taking apps
- **No Dependencies**: Pure HTML, CSS, and JavaScript - no external libraries required

## File Structure

```
brainstorming-website/
├── index.html      # Main HTML structure
├── styles.css      # All styling and responsive design
├── script.js       # Application logic and functionality
└── README.md       # This documentation
```

## Browser Compatibility

Works in all modern browsers including:
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Tips for Effective Brainstorming

1. **Start Broad**: Begin with open-ended questions
2. **Use Colors**: Rate ideas as you go to avoid losing good ones
3. **Get Inspired**: Use the inspiration panel when stuck
4. **Filter Regularly**: Review your "green" and "purple" ideas
5. **Stay Organized**: Use multiple concepts for different projects
6. **Think Laterally**: Use random words to spark unexpected connections

Enjoy your brainstorming sessions! 🧠✨