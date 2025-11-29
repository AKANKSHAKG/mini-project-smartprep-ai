// app.js - Main application functionality for NeuroStudy AI

document.addEventListener('DOMContentLoaded', function() {
    // Global state
    let currentFlashcards = [];
    let currentCardIndex = 0;
    let isCardFlipped = false;
    let currentQuiz = null;
    let currentQuizQuestionIndex = 0;
    let userQuizAnswers = [];
    
    // Initialize the app
    initApp();
    
    function initApp() {
        setupEventListeners();
        setupTabNavigation();
        checkServerHealth();
    }
    
    function setupEventListeners() {
        // Flashcard generation
        document.getElementById('generateFlashcards').addEventListener('click', generateFlashcards);
        document.getElementById('clearFlashcards').addEventListener('click', clearFlashcards);
        document.getElementById('shuffleFlash').addEventListener('click', shuffleFlashcards);
        
        // Flashcard navigation
        document.getElementById('prevCard').addEventListener('click', showPreviousCard);
        document.getElementById('nextCard').addEventListener('click', showNextCard);
        document.getElementById('flipCard').addEventListener('click', flipCard);
        
        // Quiz functionality
        document.getElementById('generateQuiz').addEventListener('click', generateQuiz);
        document.getElementById('clearQuiz').addEventListener('click', clearQuiz);
        document.getElementById('resetQuiz').addEventListener('click', resetQuiz);
        
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
    
    function flipCard() {
        const card = document.querySelector('.card');
        card.classList.toggle('flipped');
        isCardFlipped = !isCardFlipped;
    }
    
    // Quiz Functions
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
        currentQuizQuestionIndex = 0;
        userQuizAnswers = [];
        
        document.getElementById('quizContainer').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🎯</div>
                <h3>Ready to Test Yourself?</h3>
                <p>Enter a topic above to generate a custom quiz</p>
            </div>
        `;
        
        document.getElementById('quizTopic').value = '';
        document.getElementById('quizCount').textContent = '0 questions';
        document.getElementById('quizTopicDisplay').textContent = '';
        document.getElementById('resetQuiz').style.display = 'none';
        
        showNotification('Quiz cleared', 'info');
    }
    
    function resetQuiz() {
        currentQuizQuestionIndex = 0;
        userQuizAnswers = [];
        displayQuiz();
    }
    
    function displayQuiz() {
        if (!currentQuiz || currentQuiz.questions.length === 0) return;
        
        const quizContainer = document.getElementById('quizContainer');
        document.getElementById('quizCount').textContent = `${currentQuiz.questions.length} questions`;
        document.getElementById('quizTopicDisplay').textContent = currentQuiz.topic;
        document.getElementById('resetQuiz').style.display = 'block';
        
        currentQuizQuestionIndex = 0;
        userQuizAnswers = [];
        displayQuizQuestion();
    }
    
    function displayQuizQuestion() {
        if (!currentQuiz || currentQuiz.questions.length === 0) return;
        
        const question = currentQuiz.questions[currentQuizQuestionIndex];
        const quizContainer = document.getElementById('quizContainer');
        const isLastQuestion = currentQuizQuestionIndex === currentQuiz.questions.length - 1;
        const allQuestionsAnswered = userQuizAnswers.filter(answer => answer).length === currentQuiz.questions.length;
        
        quizContainer.innerHTML = `
            <div class="quiz-question">
                <div class="quiz-progress">
                    Question ${currentQuizQuestionIndex + 1} of ${currentQuiz.questions.length}
                </div>
                <h3 class="quiz-question-text">${question.question}</h3>
                <div class="quiz-options">
                    ${question.options.map((option, index) => `
                        <button class="quiz-option" data-option="${String.fromCharCode(65 + index)}">
                            <span class="option-letter">${String.fromCharCode(65 + index)}</span>
                            <span class="option-text">${option}</span>
                        </button>
                    `).join('')}
                </div>
                <div class="quiz-navigation">
                    <button class="btn btn-ghost" id="prevQuizQuestion" ${currentQuizQuestionIndex === 0 ? 'disabled' : ''}>
                        Previous
                    </button>
                    <button class="btn btn-ghost" id="nextQuizQuestion" ${isLastQuestion ? 'disabled' : ''}>
                        Next
                    </button>
                    ${isLastQuestion ? `
                        <button class="btn btn-primary" id="submitQuiz" ${!allQuestionsAnswered ? 'disabled' : ''}>
                            Submit Quiz
                        </button>
                    ` : ''}
                </div>
                ${!allQuestionsAnswered ? `
                    <div class="quiz-warning">
                        ⚠️ Please answer all questions before submitting
                    </div>
                ` : ''}
            </div>
        `;
        
        // Add event listeners for options
        document.querySelectorAll('.quiz-option').forEach(option => {
            option.addEventListener('click', function() {
                selectQuizOption(this.getAttribute('data-option'));
            });
        });
        
        // Add navigation event listeners
        document.getElementById('prevQuizQuestion').addEventListener('click', showPreviousQuizQuestion);
        
        if (!isLastQuestion) {
            document.getElementById('nextQuizQuestion').addEventListener('click', showNextQuizQuestion);
        } else {
            document.getElementById('submitQuiz').addEventListener('click', showQuizResults);
        }
        
        // Highlight previously selected option if any
        const previousAnswer = userQuizAnswers[currentQuizQuestionIndex];
        if (previousAnswer) {
            document.querySelectorAll('.quiz-option').forEach(option => {
                if (option.getAttribute('data-option') === previousAnswer) {
                    option.classList.add('selected');
                }
            });
        }
    }
    
    function selectQuizOption(selectedOption) {
        userQuizAnswers[currentQuizQuestionIndex] = selectedOption;
        
        // Highlight selected option
        document.querySelectorAll('.quiz-option').forEach(option => {
            option.classList.remove('selected');
            if (option.getAttribute('data-option') === selectedOption) {
                option.classList.add('selected');
            }
        });
        
        // Update submit button state if we're on the last question
        const isLastQuestion = currentQuizQuestionIndex === currentQuiz.questions.length - 1;
        const allQuestionsAnswered = userQuizAnswers.filter(answer => answer).length === currentQuiz.questions.length;
        
        if (isLastQuestion) {
            const submitBtn = document.getElementById('submitQuiz');
            if (submitBtn) {
                submitBtn.disabled = !allQuestionsAnswered;
            }
            
            // Show/hide warning message
            const warningElement = document.querySelector('.quiz-warning');
            if (warningElement) {
                warningElement.style.display = allQuestionsAnswered ? 'none' : 'block';
            }
        }
    }
    
    function showPreviousQuizQuestion() {
        if (currentQuizQuestionIndex > 0) {
            currentQuizQuestionIndex--;
            displayQuizQuestion();
        }
    }
    
    function showNextQuizQuestion() {
        if (currentQuizQuestionIndex < currentQuiz.questions.length - 1) {
            currentQuizQuestionIndex++;
            displayQuizQuestion();
        }
    }
    
    function showQuizResults() {
        if (!currentQuiz) return;
        
        console.log("📊 Showing quiz results...");
        console.log("User answers:", userQuizAnswers);
        console.log("Quiz questions:", currentQuiz.questions);
        
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
        const quizContainer = document.getElementById('quizContainer');
        
        quizContainer.innerHTML = `
            <div class="quiz-results">
                <div class="results-header">
                    <h3>Quiz Results</h3>
                    <div class="score-display">
                        <span class="score-value">${score}%</span>
                        <span class="score-text">${correctCount}/${currentQuiz.questions.length} correct</span>
                    </div>
                </div>
                <div class="results-breakdown">
                    ${results.map((result, index) => `
                        <div class="result-item ${result.isCorrect ? 'correct' : 'incorrect'}">
                            <div class="result-question">
                                <strong>Q${index + 1}:</strong> ${result.question}
                            </div>
                            <div class="result-answer">
                                Your answer: <span class="user-answer">${result.userAnswer}</span>
                                ${!result.isCorrect ? ` | Correct answer: <span class="correct-answer">${result.correctAnswer}</span>` : ''}
                            </div>
                            ${result.explanation ? `<div class="result-explanation">${result.explanation}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
                <div class="results-actions">
                    <button class="btn btn-primary" onclick="resetQuiz()">
                        Try Again
                    </button>
                    <button class="btn btn-ghost" onclick="generateQuiz()">
                        New Quiz
                    </button>
                </div>
            </div>
        `;
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
            
            /* Quiz warning styles */
            .quiz-warning {
                background: #fef3c7;
                border: 1px solid #f59e0b;
                border-radius: 8px;
                padding: 12px;
                margin-top: 16px;
                color: #92400e;
                font-size: 14px;
                text-align: center;
            }
            
            /* Results actions styles */
            .results-actions {
                display: flex;
                gap: 12px;
                justify-content: center;
                margin-top: 24px;
            }
        `;
        document.head.appendChild(styles);
    }
});
// Make flashcards clickable to flip
document.addEventListener('click', function(e) {
    // Check if click is on a flashcard
    const card = e.target.closest('.card.large');
    if (card) {
        card.classList.toggle('flipped');
    }
});