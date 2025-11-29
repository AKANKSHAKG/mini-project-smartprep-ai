from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import requests
import os

app = Flask(__name__)
CORS(app)

# Get host from ENV (works better) — fallback to localhost
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")

def check_ollama():
    try:
        response = requests.get(f'{OLLAMA_HOST}/api/tags', timeout=3)
        return response.status_code == 200
    except:
        return False

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok',
        'ollama_connected': check_ollama()
    })


# ------ FLASHCARDS ------
@app.route('/api/generate_flashcards', methods=['POST'])
def generate_flashcards():
    try:
        topic = request.json.get('topic', '').strip()
        if not topic:
            return jsonify({'success': False, 'error': 'Topic is required'}), 400
        
        if not check_ollama():
            return jsonify({'success': False, 'error': 'Ollama not running'}), 503

        prompt = f"""
Generate exactly 5 flashcards about {topic}.
Format strictly:
Q: question
A: answer (1–2 lines)
"""

        response = requests.post(
            f'{OLLAMA_HOST}/api/generate',
            json={'model': 'phi3:mini', 'prompt': prompt, 'stream': False},
            timeout=50
        )

        if response.status_code == 200:
            return jsonify({'success': True, 'flashcards_text': response.json().get('response', '')})

        return jsonify({'success': False, 'error': 'Model error'}), 500

    except requests.exceptions.Timeout:
        return jsonify({'success': False, 'error': 'AI timeout, retry topic'}), 408
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ------ QUIZ ------
@app.route('/api/generate_quiz', methods=['POST'])
def generate_quiz():
    try:
        topic = request.json.get('topic', '').strip()
        if not topic:
            return jsonify({'success': False, 'error': 'Topic is required'}), 400
        
        if not check_ollama():
            return jsonify({'success': False, 'error': 'Ollama not running'}), 503

        prompt = f"""
Make 3 MCQ questions on {topic}.
Format:
Q:
A) 
B) 
C) 
D)
ANSWER: letter
"""

        response = requests.post(
            f'{OLLAMA_HOST}/api/generate',
            json={'model': 'phi3:mini', 'prompt': prompt, 'stream': False},
            timeout=50
        )

        if response.status_code == 200:
            return jsonify({'success': True, 'quiz_text': response.json().get('response', '')})

        return jsonify({'success': False, 'error': 'Model error'}), 500

    except requests.exceptions.Timeout:
        return jsonify({'success': False, 'error': 'AI timeout'}), 408
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ------ CHAT ------
@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        msg = request.json.get('message', '').strip()
        context = request.json.get('context', '')
        if not msg:
            return jsonify({'success': False, 'error': 'Message required'}), 400
        
        if not check_ollama():
            return jsonify({'success': False, 'error': 'Ollama not running'}), 503

        prompt = f"""
Answer clearly in ≤100 words.
Question: {msg}
{"Context: " + context if context else ""}
"""

        response = requests.post(
            f'{OLLAMA_HOST}/api/generate',
            json={'model': 'phi3:mini', 'prompt': prompt, 'stream': False},
            timeout=40
        )

        if response.status_code == 200:
            text = response.json().get('response', '').replace("ANSWER:", "").strip()
            return jsonify({'success': True, 'response': text})

        return jsonify({'success': False, 'error': 'Model error'}), 500

    except requests.exceptions.Timeout:
        return jsonify({'success': False, 'error': 'AI timeout, try again'}), 408
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/')
def index():
    return render_template('index.html')


if __name__ == '__main__':
    print("🚀 NeuroStudy AI running...")
    print(f"🔗 Using Ollama at: {OLLAMA_HOST}")
    app.run(debug=True, port=5000)
