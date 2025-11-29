// app.js - Main application functionality for SmartPrep AI

document.addEventListener('DOMContentLoaded', function() {
    // Global state
    let currentFlashcards = [];
    let currentCardIndex = 0;
    let isCardFlipped = false;
    let currentQuiz = null;
    let userQuizAnswers = [];
    
    // Initialize the app
    initApp();
    
    function initApp() {
        setupEventListeners();
        setupTabNavigation();
        checkServerHealth();
        
        // Make flashcards clickable to flip
        setupFlashcardClick();
    }
    
    function setupEventListeners() {
        // Flashcard generation
        document.getElementById('generateFlashcards').addEventListener('click', generateFlashcards);
        document.getElementById('clearFlashcards').addEventListener('click', clearFlashcards);
        document.getElementById('shuffleFlash').addEventListener('click', shuffleFlashcards);
        
        // Flashcard navigation
        document.getElementById('prevCard').addEventListener('click', showPreviousCard);
        document.getElementById('nextCard').addEventListener('click', showNextCard);
        
        // Quiz functionality
        document.getElementById('generateQuiz').addEventListener('click', generateQuiz);
        document.getElementById('clearQuiz').addEventListener('click', clearQuiz);
        document.getElementById('restartQuiz').addEventListener('click', resetQuiz);
        
        // Quiz form submission
        document.getElementById('quizForm').addEventListener('submit', function(e) {
            e.preventDefault();
            showQuizResults();
        });
        
        // Results buttons
        document.addEventListener('click', function(e) {
            if (e.target.id === 'retakeQuiz') {
                resetQuiz();
            } else if (e.target.id === 'newQuiz') {
                clearQuiz();
            }
        });
        
        // Chat functionality
        document.getElementById('sendMessage').addEventListener('click', sendChatMessage);
        document.getElementById('chatInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });
        
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    }
    
    function setupTabNavigation() {
        const navButtons = document.querySelectorAll('.nav-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        
        navButtons.forEach(button => {
            button.addEventListener('click', function() {
                const targetTab = this.getAttribute('data-tab');
                
                // Update active nav button
                navButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                
                // Show target tab
                tabContents.forEach(tab => tab.classList.remove('active'));
                document.getElementById(targetTab).classList.add('active');
            });
        });
    }
    
    function setupFlashcardClick() {
        // Make flashcards clickable to flip
        document.addEventListener('click', function(e) {
            const card = e.target.closest('.card.large');
            if (card) {
                card.classList.toggle('flipped');
                isCardFlipped = !isCardFlipped;
            }
        });
    }
    
    // Flashcard Functions
    async function generateFlashcards() {
        const topicInput = document.getElementById('flashcardTopic');
        const topic = topicInput.value.trim();
        const generateBtn = document.getElementById('generateFlashcards');
        const loadingText = generateBtn.querySelector('.btn-loading');
        const normalText = generateBtn.querySelector('.btn-text');
        
        if (!topic) {
            showNotification('Please enter a topic for your flashcards', 'error');
            return;
        }
        
        // Show loading state
        normalText.style.display = 'none';
        loadingText.style.display = 'inline';
        generateBtn.disabled = true;
        
        try {
            const response = await fetch('/api/generate_flashcards', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ topic: topic })
            });
            
            const data = await response.json();
            
            if (data.success) {
                currentFlashcards = parseFlashcards(data.flashcards_text, topic);
                
                if (currentFlashcards.length > 0) {
                    displayFlashcards();
                    showNotification(`Generated ${currentFlashcards.length} flashcards about ${topic}`, 'success');
                } else {
                    showNotification('Could not parse flashcards from AI response. Try a different topic.', 'error');
                }
            } else {
                showNotification(data.error || 'Failed to generate flashcards', 'error');
            }
        } catch (error) {
            console.error('Error generating flashcards:', error);
            showNotification('Network error. Please check if Ollama is running.', 'error');
        } finally {
            // Restore button state
            normalText.style.display = 'inline';
            loadingText.style.display = 'none';
            generateBtn.disabled = false;
        }
    }
    
    function clearFlashcards() {
        currentFlashcards = [];
        currentCardIndex = 0;
        isCardFlipped = false;
        
        document.getElementById('flashcardsGrid').style.display = 'block';
        document.getElementById('singleFlashcardView').style.display = 'none';
        document.getElementById('flashcardTopic').value = '';
        document.getElementById('flashcardCount').textContent = '0 cards';
        document.getElementById('currentTopic').textContent = '';
        
        showNotification('Flashcards cleared', 'info');
    }
    
    function shuffleFlashcards() {
        if (currentFlashcards.length === 0) return;
        
        for (let i = currentFlashcards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [currentFlashcards[i], currentFlashcards[j]] = [currentFlashcards[j], currentFlashcards[i]];
        }
        
        currentCardIndex = 0;
        displayCurrentCard();
        showNotification('Flashcards shuffled', 'info');
    }
    
    function displayFlashcards() {
        if (currentFlashcards.length === 0) return;
        
        document.getElementById('flashcardsGrid').style.display = 'none';
        document.getElementById('singleFlashcardView').style.display = 'block';
        
        document.getElementById('flashcardCount').textContent = `${currentFlashcards.length} cards`;
        document.getElementById('currentTopic').textContent = document.getElementById('flashcardTopic').value;
        
        currentCardIndex = 0;
        isCardFlipped = false;
        displayCurrentCard();
    }
    
    function displayCurrentCard() {
        if (currentFlashcards.length === 0) return;
        
        const card = currentFlashcards[currentCardIndex];
        document.getElementById('currentQuestion').textContent = card[0];
        document.getElementById('currentAnswer').textContent = card[1];
        
        // Reset card to front
        document.querySelector('.card').classList.remove('flipped');
        isCardFlipped = false;
        
        // Update navigation
        document.getElementById('prevCard').disabled = currentCardIndex === 0;
        document.getElementById('nextCard').disabled = currentCardIndex === currentFlashcards.length - 1;
        
        // Update progress
        document.getElementById('currentCardNumber').textContent = currentCardIndex + 1;
        document.getElementById('totalCards').textContent = currentFlashcards.length;
        
        const progressPercent = ((currentCardIndex + 1) / currentFlashcards.length) * 100;
        document.getElementById('progressFill').style.width = `${progressPercent}%`;
    }
    
    function showPreviousCard() {
        if (currentCardIndex > 0) {
            currentCardIndex--;
            displayCurrentCard();
        }
    }
    
    function showNextCard() {
        if (currentCardIndex < currentFlashcards.length - 1) {
            currentCardIndex++;
            displayCurrentCard();
        }
    }
    
    // Quiz Functions - NEW VERSION (All questions at once)
    async function generateQuiz() {
        const topicInput = document.getElementById('quizTopic');
        const topic = topicInput.value.trim();
        const generateBtn = document.getElementById('generateQuiz');
        const loadingText = generateBtn.querySelector('.btn-loading');
        const normalText = generateBtn.querySelector('.btn-text');
        
        if (!topic) {
            showNotification('Please enter a topic for your quiz', 'error');
            return;
        }
        
        // Show loading state
        normalText.style.display = 'none';
        loadingText.style.display = 'inline';
        generateBtn.disabled = true;
        
        try {
            const response = await fetch('/api/generate_quiz', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ topic: topic })
            });
            
            const data = await response.json();
            
            if (data.success) {
                currentQuiz = parseQuiz(data.quiz_text, topic);
                
                if (currentQuiz.questions.length > 0) {
                    displayQuiz();
                    showNotification(`Generated ${currentQuiz.questions.length} quiz questions about ${topic}`, 'success');
                } else {
                    showNotification('Could not parse quiz questions from AI response. Try a different topic.', 'error');
                }
            } else {
                showNotification(data.error || 'Failed to generate quiz', 'error');
            }
        } catch (error) {
            console.error('Error generating quiz:', error);
            showNotification('Network error. Please check if Ollama is running.', 'error');
        } finally {
            // Restore button state
            normalText.style.display = 'inline';
            loadingText.style.display = 'none';
            generateBtn.disabled = false;
        }
    }
    
    function clearQuiz() {
        currentQuiz = null;
        userQuizAnswers = [];
        
        document.getElementById('quizQuestionsContainer').innerHTML = '';
        document.getElementById('quizResults').style.display = 'none';
        document.querySelector('.quiz-section').style.display = 'none';
        document.getElementById('quizTopic').value = '';
        document.getElementById('quizCount').textContent = '0 questions';
        document.getElementById('quizTopicDisplay').textContent = '';
        
        showNotification('Quiz cleared', 'info');
    }
    
    function displayQuiz() {
        if (!currentQuiz || currentQuiz.questions.length === 0) return;
        
        document.querySelector('.quiz-section').style.display = 'block';
        document.getElementById('quizCount').textContent = `${currentQuiz.questions.length} questions`;
        document.getElementById('quizTopicDisplay').textContent = currentQuiz.topic;
        
        // Initialize user answers array
        userQuizAnswers = new Array(currentQuiz.questions.length).fill(null);
        
        // Display all questions at once
        const questionsContainer = document.getElementById('quizQuestionsContainer');
        questionsContainer.innerHTML = currentQuiz.questions.map((question, index) => `
            <div class="quiz-question" data-question-index="${index}">
                <div class="question-header">
                    <span class="question-number">Question ${index + 1}</span>
                    <div class="question-text">${question.question}</div>
                </div>
                <div class="options-grid">
                    ${question.options.map((option, optionIndex) => {
                        const optionLetter = String.fromCharCode(65 + optionIndex);
                        return `
                            <div class="quiz-option" data-question="${index}" data-option="${optionLetter}">
                                <span class="option-letter">${optionLetter}</span>
                                <span class="option-text">${option}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `).join('');
        
        // Add event listeners to options
        document.querySelectorAll('.quiz-option').forEach(option => {
            option.addEventListener('click', function() {
                const questionIndex = parseInt(this.getAttribute('data-question'));
                const selectedOption = this.getAttribute('data-option');
                selectQuizOption(questionIndex, selectedOption);
            });
        });
        
        // Hide results if showing
        document.getElementById('quizResults').style.display = 'none';
    }
    
    function selectQuizOption(questionIndex, selectedOption) {
        userQuizAnswers[questionIndex] = selectedOption;
        
        // Update UI for this question
        const questionElement = document.querySelector(`[data-question-index="${questionIndex}"]`);
        questionElement.querySelectorAll('.quiz-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        const selectedElement = document.querySelector(`[data-question="${questionIndex}"][data-option="${selectedOption}"]`);
        selectedElement.classList.add('selected');
    }
    
    function showQuizResults() {
        if (!currentQuiz) return;
        
        // Check if all questions are answered
        const unansweredQuestions = userQuizAnswers.filter(answer => answer === null).length;
        if (unansweredQuestions > 0) {
            showNotification(`Please answer all ${unansweredQuestions} remaining questions before submitting.`, 'error');
            return;
        }
        
        let correctCount = 0;
        const results = currentQuiz.questions.map((question, index) => {
            const userAnswer = userQuizAnswers[index];
            const isCorrect = userAnswer === question.answer;
            if (isCorrect) correctCount++;
            
            return {
                question: question.question,
                userAnswer: userAnswer || 'Not answered',
                correctAnswer: question.answer,
                isCorrect,
                explanation: question.explanation || 'No explanation provided.'
            };
        });
        
        const score = Math.round((correctCount / currentQuiz.questions.length) * 100);
        const resultsBreakdown = document.getElementById('resultsBreakdown');
        const finalScore = document.getElementById('finalScore');
        
        // Update score with color based on performance
        finalScore.textContent = `${score}%`;
        finalScore.className = 'score-value ' + 
            (score >= 80 ? 'score-excellent' : 
             score >= 60 ? 'score-good' : 'score-poor');
        
        // Update score text
        document.getElementById('scoreText').textContent = `${correctCount}/${currentQuiz.questions.length} correct`;
        
        // Display results breakdown
        resultsBreakdown.innerHTML = results.map((result, index) => `
            <div class="result-item ${result.isCorrect ? 'correct' : 'incorrect'}">
                <div class="result-question">
                    <strong>Q${index + 1}:</strong> ${result.question}
                </div>
                <div class="result-answer">
                    <span class="answer-label">Your answer:</span>
                    <span class="answer-value ${result.isCorrect ? 'correct-indicator' : 'incorrect-indicator'}">
                        ${result.userAnswer} ${result.isCorrect ? '✓' : '✗'}
                    </span>
                </div>
                ${!result.isCorrect ? `
                    <div class="result-answer">
                        <span class="answer-label">Correct answer:</span>
                        <span class="answer-value correct-indicator">${result.correctAnswer} ✓</span>
                    </div>
                ` : ''}
                <div class="result-explanation">
                    <strong>Explanation:</strong> ${result.explanation}
                </div>
            </div>
        `).join('');
        
        // Show results section
        document.getElementById('quizResults').style.display = 'block';
        
        // Scroll to results
        document.getElementById('quizResults').scrollIntoView({ behavior: 'smooth' });
        
        showNotification(`Quiz completed! Score: ${score}%`, 'success');
    }
    
    function resetQuiz() {
        if (!currentQuiz) return;
        
        userQuizAnswers = new Array(currentQuiz.questions.length).fill(null);
        document.getElementById('quizResults').style.display = 'none';
        
        // Reset all selected options
        document.querySelectorAll('.quiz-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        showNotification('Quiz reset. You can try again!', 'info');
    }
    
    // Chat Functions
    async function sendChatMessage() {
        const chatInput = document.getElementById('chatInput');
        const contextInput = document.getElementById('chatContext');
        const message = chatInput.value.trim();
        const context = contextInput.value.trim();
        
        if (!message) {
            showNotification('Please enter a message', 'error');
            return;
        }
        
        // Add user message to chat
        addChatMessage('user', message);
        chatInput.value = '';
        
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    message: message,
                    context: context
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                addChatMessage('ai', data.response);
            } else {
                addChatMessage('ai', `Sorry, I encountered an error: ${data.error}`);
            }
        } catch (error) {
            console.error('Error sending chat message:', error);
            addChatMessage('ai', 'Sorry, I encountered a network error. Please check if Ollama is running.');
        }
    }
    
    function addChatMessage(sender, text) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${sender}`;
        
        messageDiv.innerHTML = `
            <div class="message-avatar">${sender === 'ai' ? '🤖' : '👤'}</div>
            <div class="message-content">
                <div class="message-sender">${sender === 'ai' ? 'NeuroTutor' : 'You'}</div>
                <div class="message-text">${formatChatText(text)}</div>
            </div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    function formatChatText(text) {
        // Simple formatting for better readability
        return text.replace(/\n/g, '<br>');
    }
    
    // Utility Functions
    function toggleTheme() {
        const body = document.body;
        const currentTheme = body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        body.setAttribute('data-theme', newTheme);
        
        const themeIcon = document.querySelector('.theme-icon');
        themeIcon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    }
    
    async function checkServerHealth() {
        try {
            const response = await fetch('/api/health');
            const data = await response.json();
            
            const statusIndicator = document.querySelector('.status-dot');
            if (data.ollama_connected) {
                statusIndicator.style.backgroundColor = '#10b981';
                console.log('✅ Ollama connected');
            } else {
                statusIndicator.style.backgroundColor = '#ef4444';
                console.log('❌ Ollama not connected');
            }
        } catch (error) {
            console.error('Health check failed:', error);
        }
    }
    
    function showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span class="notification-message">${message}</span>
            <button class="notification-close">&times;</button>
        `;
        
        // Add styles if not already added
        if (!document.querySelector('#notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'notification-styles';
            styles.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 12px 16px;
                    border-radius: 8px;
                    color: white;
                    z-index: 1000;
                    max-width: 300px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    animation: slideIn 0.3s ease-out;
                }
                .notification-info { background: #3b82f6; }
                .notification-success { background: #10b981; }
                .notification-error { background: #ef4444; }
                .notification-warning { background: #f59e0b; }
                .notification-close {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 18px;
                    cursor: pointer;
                    margin-left: 10px;
                }
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(styles);
        }
        
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
        
        // Close button
        notification.querySelector('.notification-close').addEventListener('click', () => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
    }
    
    // Add CSS for card flipping if not present
    if (!document.querySelector('#card-flip-styles')) {
        const styles = document.createElement('style');
        styles.id = 'card-flip-styles';
        styles.textContent = `
            .card {
                transition: transform 0.6s;
                transform-style: preserve-3d;
                position: relative;
            }
            .card.flipped {
                transform: rotateY(180deg);
            }
            .card-face {
                backface-visibility: hidden;
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
            }
            .card-back {
                transform: rotateY(180deg);
            }
        `;
        document.head.appendChild(styles);
    }
});