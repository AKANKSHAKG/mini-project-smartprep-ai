from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import requests
import os

app = Flask(__name__)
CORS(app)

# Get host from ENV (works better) — fallback to localhost
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")
def warm_up_model():
    try:
        requests.post(
            f'{OLLAMA_HOST}/api/generate',
            json={
                'model': 'phi3:mini',
                'prompt': 'Hello',
                'stream': False,
                'options': {'num_predict': 5}
            },
            timeout=10
        )
        print("✅ Ollama warmed up")
    except:
        print("⚠️ Ollama warmup failed")





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
        count = int(request.json.get('count', 5))
        count = min(count, 15)  # safety limit
   
        
        if not check_ollama():
            return jsonify({'success': False, 'error': 'Ollama not running'}), 503

        prompt = f"""
Create {count} flashcards for studying {topic}.

Format:
Q: ...
A: ...

Keep answers short.
No extra text.
"""


        response = requests.post(
    f'{OLLAMA_HOST}/api/generate',
    json={
        'model': 'phi3:mini',
        'prompt': prompt,
        'stream': False,
        'options': {
            'num_predict': 300,
            'temperature': 0.3
        }
    },
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

        count = int(request.json.get('count', 3))
        count = min(count, 5)   # ✅ LIMIT SIZE

        if not check_ollama():
            return jsonify({'success': False, 'error': 'Ollama not running'}), 503

        prompt = f"""
Create exactly {count} multiple-choice questions on {topic}.

IMPORTANT:
- Do not stop until all {count} questions are finished.


STRICT FORMAT ONLY (no extra text):

Q: question
A) option
B) option
C) option
D) option
ANSWER: A/B/C/D

Rules:
- No explanations
- Keep questions short
"""

        response = requests.post(
            f'{OLLAMA_HOST}/api/generate',
            json={
                'model': 'phi3:mini',
                'prompt': prompt,
                'stream': False,
                'options': {
                    'num_predict': 400,
                    'temperature': 0.3
                }
            },
            timeout=60
        )

        if response.status_code == 200:
            return jsonify({'success': True, 'quiz_text': response.json().get('response', '')})

        return jsonify({'success': False, 'error': 'Model error'}), 500

    except requests.exceptions.Timeout:
        return jsonify({'success': False, 'error': 'AI timeout – try a simpler topic'}), 408
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

        # ---------- Quick sanitizer for pasted instruction blocks ----------
        # If the user pasted a long instruction block (common when copying from a website),
        # ask for clarification instead of attempting to execute ambiguous multi-part instructions.
        snippet = msg[:800].lower()
        suspicious_patterns = ["instruction with", "added constraints", "### question:", "question:"]
        if any(pat in snippet for pat in suspicious_patterns) and msg.count('\n') > 4:
            return jsonify({
                'success': True,
                'response': "I detected a long instruction block. Do you want (A) a short answer, (B) code, or (C) a full derivation in LaTeX? Reply with A, B, or C."
            })

        # ---------- Intent detection ----------
        msg_lower = msg.lower()

        wants_formula = any(word in msg_lower for word in [
            "equation", "formula", "theorem", "law", "derive", "derivation", "proof", "latex", "formula:"
        ])

        wants_code = any(word in msg_lower for word in [
            "code", "program", "implementation", "in c", "in java", "in python", "c code", "cpp", "c++", "implementation:"
        ])

        wants_derivation = any(word in msg_lower for word in [
            "derive", "derivation", "prove", "proof", "latex", "euler", "reflection formula", "show that"
        ])

        wants_definition = any(word in msg_lower for word in [
            "what is", "define", "meaning of", "explain", "explain what", "kinds of", "what are"
        ])

        # If both code and formula keywords appear -> ambiguous
        if (wants_formula and wants_code) or (wants_derivation and wants_code) or (wants_formula and wants_derivation and not wants_code and not wants_definition):
            # Ask a short clarifying question so the user chooses the desired format.
            return jsonify({
                'success': True,
                'response': "I detected multiple possible intents (formula vs code vs derivation). Do you want (1) the formula only, (2) a code implementation, or (3) a full derivation/explanation? Reply with 1, 2, or 3."
            })

        # ---------- Build a focused prompt based on detected intent ----------
        if wants_derivation:
            # User asked for a derivation / LaTeX
            prompt = f"""
Provide a clear, rigorous derivation in LaTeX for the following request.
Only include mathematical steps and final LaTeX output. Do not include runnable code.
Request: {msg}
"""
            options = {'num_predict': 400, 'temperature': 0.2}
            timeout_seconds = 80

        elif wants_formula and not wants_code:
            # User wants purely the formula
            prompt = f"""
Provide ONLY the mathematical formula, on a single line.
Do NOT include code, explanation, or commentary.

Request: {msg}
"""
            options = {'num_predict': 80, 'temperature': 0.0}
            timeout_seconds = 20

        elif wants_code:
            # User wants code implementation
            # Keep code short and minimal; ask for pseudocode if the algorithm is too large.
            prompt = f"""
Provide ONLY a minimal implementation in C for the request. No explanation, no comments.
If the requested algorithm is large and would require many lines, return concise pseudocode instead.
Request: {msg}
"""
            options = {'num_predict': 300, 'temperature': 0.2}
            timeout_seconds = 90

        elif wants_definition:
            # Short conceptual explanation
            prompt = f"""
Explain the concept clearly in simple words (max 100 words). No code, no formulas unless requested.
Question: {msg}
{"Context: " + context if context else ""}
"""
            options = {'num_predict': 140, 'temperature': 0.25}
            timeout_seconds = 30

        else:
            # Fallback: give a concise helpful answer
            prompt = f"""
Answer concisely (max 80 words). If the user asks for code or formula explicitly, do not include it.
Question: {msg}
{"Context: " + context if context else ""}
"""
            options = {'num_predict': 140, 'temperature': 0.25}
            timeout_seconds = 30

        # ---------- Send to Ollama ----------
        response = requests.post(
            f'{OLLAMA_HOST}/api/generate',
            json={
                'model': 'phi3:mini',
                'prompt': prompt,
                'stream': False,
                'options': options
            },
            timeout=timeout_seconds
        )

        if response.status_code == 200:
            text = response.json().get('response', '').strip()
            # If user asked for formula-only, try to trim surrounding backticks or code fences
            if wants_formula and not wants_code:
                # Remove code fences and return bare formula
                text = text.strip().strip('`').strip()
                # Keep only first non-empty line (single-line formula)
                lines = [l.strip() for l in text.splitlines() if l.strip()]
                if lines:
                    text = lines[0]
            return jsonify({'success': True, 'response': text})

        return jsonify({'success': False, 'error': 'Model error'}), 500

    except requests.exceptions.Timeout:
        return jsonify({'success': False, 'error': 'AI timeout, try again'}), 408
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500



@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")

@app.route("/")
def landing():
    return render_template("index.html")


if __name__ == '__main__':
    print("🚀 SmartPrepAi running...")
    print(f"🔗 Using Ollama at: {OLLAMA_HOST}")
    warm_up_model()
    print("🌐 Server starting at: http://127.0.0.1:5000")  # ADD THIS LINE
    app.run(debug=True, port=5000)