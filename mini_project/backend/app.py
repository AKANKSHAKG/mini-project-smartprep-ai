# backend/app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
from llm_client import generate_from_ollama

app = Flask(__name__, static_folder="static", static_url_path="/")
CORS(app)

@app.route("/")
def index():
    return app.send_static_file("index.html")

@app.route("/api/generate", methods=["POST"])
def generate():
    data = request.json or {}
    prompt = data.get("prompt", "")
    model = data.get("model", "phi3:mini")
    if not prompt:
        return jsonify({"error": "missing prompt"}), 400
    try:
        out = generate_from_ollama(prompt, model=model)
        return jsonify({"output": out})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
