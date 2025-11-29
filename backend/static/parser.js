// More flexible parser for Ollama responses
function parseFlashcards(text, topic = '') {
    if (!text) {
        console.log("❌ No text provided to parser");
        return [];
    }
    
    console.log("📝 Raw flashcards text:", text);
    
    const lines = text.split('\n').filter(line => line.trim().length > 3);
    const flashcards = [];
    
    // Method 1: Look for ANY question-like patterns
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // More flexible question detection
        if (line.match(/\?$/) || // Ends with question mark
            line.match(/^Q[:\.\-\s]|^Question|^[\d]+[:\.]/i) || // Starts with Q, Question, or number
            (line.length > 15 && line.match(/what|how|why|when|where|who|explain|define/gi))) { // Contains question words
            
            let question = line;
            let answer = '';
            
            // Remove Q: prefix if present
            question = question.replace(/^Q[:\.\-\s]\s*|^Question\s*\d*[:\.\-\s]*/i, '').trim();
            question = question.replace(/^[\d]+[:\.]\s*/, '').trim(); // Remove numbered prefixes
            
            // Look for answer in next 1-3 lines
            for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
                const nextLine = lines[j].trim();
                
                // Answer detection - more flexible
                if (nextLine.match(/^A[:\.\-\s]|^Answer|^[\d]+[:\.]\s*[^?]$/i) || // Starts with A, Answer, or number (not question)
                    (nextLine.length > 8 && !nextLine.match(/\?$/) && !nextLine.match(/^Q|^Question|^[\d]+[:\.]\s*.*\?/i))) {
                    
                    answer = nextLine.replace(/^A[:\.\-\s]\s*|^Answer\s*[:\.\-\s]*/i, '').trim();
                    answer = answer.replace(/^[\d]+[:\.]\s*/, '').trim(); // Remove numbered prefixes
                    i = j;
                    break;
                }
            }
            
            if (question && answer) {
                // Ensure question ends with question mark if it's a question
                if (!question.endsWith('?') && question.match(/what|how|why|when|where|who|explain|define/gi)) {
                    question += '?';
                }
                
                flashcards.push([cleanText(question), cleanText(answer)]);
                
                // Stop if we have enough flashcards
                if (flashcards.length >= 5) break;
            }
        }
    }
    
    // Method 2: If still no flashcards, split by empty lines and take pairs
    if (flashcards.length === 0) {
        console.log("🔄 Trying alternative parsing method...");
        
        // Split by empty lines or number patterns
        const blocks = text.split(/\n\s*\n|\d+\./).filter(block => block.trim().length > 10);
        
        for (let i = 0; i < blocks.length - 1; i += 2) {
            let question = blocks[i].trim();
            let answer = blocks[i + 1] ? blocks[i + 1].trim() : '';
            
            // Clean up the texts
            question = question.replace(/^Q[:\.\-\s]\s*/i, '').trim();
            answer = answer.replace(/^A[:\.\-\s]\s*/i, '').trim();
            
            if (question && answer && question.length > 5 && answer.length > 5) {
                if (!question.endsWith('?')) {
                    question += '?';
                }
                flashcards.push([cleanText(question), cleanText(answer)]);
                
                if (flashcards.length >= 3) break;
            }
        }
    }
    
    // Method 3: Last resort - split text and create simple pairs
    if (flashcards.length === 0) {
        console.log("🔄 Using fallback parsing...");
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
        
        for (let i = 0; i < sentences.length - 1; i += 2) {
            let question = sentences[i].trim();
            let answer = sentences[i + 1].trim();
            
            if (question && answer) {
                if (!question.endsWith('?')) question += '?';
                flashcards.push([cleanText(question), cleanText(answer)]);
                
                if (flashcards.length >= 3) break;
            }
        }
    }
    
    console.log("✅ Parsed flashcards:", flashcards);
    return flashcards.slice(0, 5); // Limit to 5 flashcards
}

function parseQuiz(text, topic = '') {
    if (!text) {
        console.log("❌ No quiz text provided");
        return { questions: [] };
    }
    
    console.log("📝 Raw quiz text:", text);
    const lines = text.split('\n').filter(line => line.trim().length > 2);
    const questions = [];
    let currentQuestion = null;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // More flexible question detection
        if (line.match(/^Q[:\.]|^\d+\.|^Question/i) && line.length > 10) {
            if (currentQuestion && currentQuestion.options.length >= 2) {
                questions.push(currentQuestion);
            }
            
            currentQuestion = {
                question: line.replace(/^Q[:\.]\s*|^\d+\.\s*|^Question\s*\d*[:\.\s]*/i, '').trim(),
                options: [],
                answer: '',
                explanation: ''
            };
        }
        // More flexible option detection
        else if (currentQuestion && line.match(/^[A-D][\)\.\-\s]|^Option\s*[A-D]/i)) {
            const optionText = line.replace(/^[A-D][\)\.\-\s]\s*|^Option\s*[A-D][\-\s]*/i, '').trim();
            if (optionText && optionText.length > 1) {
                currentQuestion.options.push(cleanText(optionText));
            }
        }
        // More flexible answer detection
        else if (line.match(/^ANSWER:\s*[A-D]|^Correct:\s*[A-D]|^Right.*[A-D]/i)) {
            const match = line.match(/[A-D]/i);
            if (match && currentQuestion) {
                currentQuestion.answer = match[0].toUpperCase();
            }
        }
        // More flexible explanation detection
        else if (currentQuestion && line.match(/^EXPLANATION:|^Explanation|^Note:|^Reason:/i)) {
            currentQuestion.explanation = line.replace(/^EXPLANATION:\s*|^Explanation:\s*|^Note:\s*|^Reason:\s*/i, '').trim();
        }
        // If we have a question but no options yet, and this line looks like content
        else if (currentQuestion && currentQuestion.options.length === 0 && line.length > 10 && !line.match(/^[A-D]|^Answer|^Q|^\d+/i)) {
            // This might be the question continuation
            currentQuestion.question += ' ' + line;
        }
    }
    
    // Add the last question
    if (currentQuestion && currentQuestion.options.length >= 2) {
        questions.push(currentQuestion);
    }
    
    // Ensure we have 4 options for each question
    const validQuestions = questions.map(q => {
        while (q.options.length < 4) {
            q.options.push(`Option ${String.fromCharCode(65 + q.options.length)}`);
        }
        // If no answer found, default to A
        if (!q.answer && q.options.length > 0) {
            q.answer = 'A';
        }
        return q;
    }).filter(q => q.question && q.options.length === 4 && q.answer);
    
    console.log("✅ Parsed quiz questions:", validQuestions);
    return { questions: validQuestions, topic: topic };
}

function cleanText(text) {
    if (!text) return '';
    // Remove extra whitespace and clean up
    return text.replace(/\s+/g, ' ').replace(/\*\*/g, '').trim();
}
// Add this at the very end of your parser.js file:
window.parseFlashcards = parseFlashcards;
window.parseQuiz = parseQuiz;
window.cleanText = cleanText;