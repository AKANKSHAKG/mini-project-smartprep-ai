from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import requests
import time

app = Flask(__name__)
CORS(app)

OLLAMA_HOST = 'http://localhost:11434'

def check_ollama():
    try:
        response = requests.get(f'{OLLAMA_HOST}/api/tags', timeout=5)
        return response.status_code == 200
    except:
        return False

@app.route('/api/health', methods=['GET'])
def health_check():
    ollama_connected = check_ollama()
    return jsonify({
        'status': 'ok',
        'ollama_connected': ollama_connected
    })

@app.route('/api/generate_flashcards', methods=['POST'])
def generate_flashcards():
    try:
        data = request.get_json()
        topic = data.get('topic', '').strip()
        
        if not topic:
            return jsonify({'success': False, 'error': 'Topic is required'}), 400

        if not check_ollama():
            return jsonify({
                'success': False, 
                'error': 'Ollama not running. Please start with: ollama serve'
            }), 503

        print(f"🎯 Generating 5 flashcards for: {topic}")

        prompt = f"""Create exactly 5 educational flashcards about {topic}. 

IMPORTANT FORMATTING RULES:
- Each flashcard must be exactly 2 lines: Q: question? and A: answer.
- Questions should be clear and test understanding
- Answers should be concise (1-2 sentences max)
- Use simple language
- No extra explanations or notes

EXAMPLE:
Q: What is photosynthesis?
A: The process where plants convert sunlight into energy.

Q: Why is photosynthesis important?
A: It produces oxygen and provides energy for plants.

Now create 5 flashcards about {topic} following the exact format above:"""

        response = requests.post(f'{OLLAMA_HOST}/api/generate', 
            json={
                'model': 'phi3:mini',
                'prompt': prompt,
                'stream': False,
                'options': {
                    'temperature': 0.3,  # Lower temperature for more consistent output
                    'top_p': 0.9
                }
            },
            timeout=90  # Increased timeout
        )
        
        print(f"📨 Flashcards response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            response_text = result.get('response', '')
            print(f"✅ Raw AI response: {response_text}")
            
            return jsonify({
                'success': True,
                'flashcards_text': response_text
            })
        else:
            print(f"❌ Ollama error: {response.status_code}")
            return jsonify({
                'success': False, 
                'error': f'Ollama error: {response.status_code}'
            }), 500

    except requests.exceptions.Timeout:
        print(f"⏰ Ollama timeout for flashcards")
        return jsonify({
            'success': False,
            'error': 'AI is taking too long to respond. Please try a simpler topic.'
        }), 408
    except Exception as e:
        print(f"💥 Server error: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Server error: {str(e)}'
        }), 500

@app.route('/api/generate_quiz', methods=['POST'])
def generate_quiz():
    try:
        data = request.get_json()
        topic = data.get('topic', '').strip()
        
        if not topic:
            return jsonify({'success': False, 'error': 'Topic is required'}), 400

        if not check_ollama():
            return jsonify({
                'success': False, 
                'error': 'Ollama not running'
            }), 503

        print(f"🎯 Generating quiz for: {topic}")

        prompt = f"""Create exactly 3 multiple choice questions about {topic}. 

IMPORTANT FORMATTING RULES:
- Each question must have exactly 4 options (A, B, C, D)
- One option must be clearly correct
- Options should be plausible but distinct
- Include ANSWER: [letter] after each question
- Questions should test different aspects of {topic}

FORMAT EXAMPLE:
Q: What is the main purpose of photosynthesis?
A) To absorb water from soil
B) To convert sunlight into energy
C) To produce flowers
D) To attract insects
ANSWER: B

Q: Which organelle performs photosynthesis?
A) Mitochondria
B) Nucleus  
C) Chloroplast
D) Ribosome
ANSWER: C

Q: What gas do plants release during photosynthesis?
A) Carbon dioxide
B) Nitrogen
C) Oxygen
D) Hydrogen
ANSWER: C

Now create 3 questions about {topic} following the exact format above:"""

        response = requests.post(f'{OLLAMA_HOST}/api/generate', 
            json={
                'model': 'phi3:mini',
                'prompt': prompt,
                'stream': False,
                'options': {
                    'temperature': 0.3,
                    'top_p': 0.9
                }
            },
            timeout=90
        )
        
        print(f"📨 Quiz response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            response_text = result.get('response', '')
            print(f"✅ Raw AI quiz: {response_text}")
            
            return jsonify({
                'success': True,
                'quiz_text': response_text
            })
        else:
            print(f"❌ Ollama error: {response.status_code}")
            return jsonify({
                'success': False, 
                'error': f'Ollama error: {response.status_code}'
            }), 500

    except requests.exceptions.Timeout:
        print(f"⏰ Ollama timeout for quiz")
        return jsonify({
            'success': False,
            'error': 'AI is taking too long to respond. Please try a simpler topic.'
        }), 408
    except Exception as e:
        print(f"💥 Server error: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Server error: {str(e)}'
        }), 500

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        message = data.get('message', '').strip()
        context = data.get('context', '').strip()
        
        if not message:
            return jsonify({'success': False, 'error': 'Message is required'}), 400

        if not check_ollama():
            return jsonify({
                'success': False, 
                'error': 'Ollama not running'
            }), 503

        print(f"💬 Chat request: {message}")

        # Improved prompt for concise, helpful responses
        prompt = f"""You are a helpful AI tutor. Provide a clear, concise answer to the student's question.

STUDENT QUESTION: {message}
{"CONTEXT/SUBJECT: " + context if context else ""}

GUIDELINES:
- Keep answer under 100 words
- Focus on key concepts
- Use simple, clear language
- Be educational but not overly technical
- If explaining a process, use 2-3 steps max
- End with a quick summary

ANSWER:"""

        response = requests.post(f'{OLLAMA_HOST}/api/generate', 
            json={
                'model': 'phi3:mini',
                'prompt': prompt,
                'stream': False,
                'options': {
                    'temperature': 0.7,
                    'top_p': 0.9,
                    'num_predict': 200  # Limit response length
                }
            },
            timeout=60
        )
        
        print(f"📨 Chat response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            response_text = result.get('response', '').strip()
            
            # Clean up any extra formatting the AI might add
            if response_text.startswith('ANSWER:'):
                response_text = response_text[7:].strip()
                
            return jsonify({
                'success': True,
                'response': response_text
            })
        else:
            print(f"❌ Ollama error: {response.status_code}")
            return jsonify({
                'success': False, 
                'error': f'Ollama error: {response.status_code}'
            }), 500

    except requests.exceptions.Timeout:
        print(f"⏰ Ollama timeout for chat")
        return jsonify({
            'success': False,
            'error': 'AI is taking too long to respond. Please try rephrasing your question.'
        }), 408
    except Exception as e:
        print(f"💥 Server error: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Server error: {str(e)}'
        }), 500

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    print("🚀 NeuroStudy AI - Improved Version")
    if check_ollama():
        print("✅ Ollama connected - 100% Real AI")
    else:
        print("❌ Ollama not connected - App will not work")
    print("🌐 Server: http://localhost:5000")
