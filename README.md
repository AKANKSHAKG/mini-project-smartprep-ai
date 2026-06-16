SmartPrepAI — Offline AI Study Assistant

SmartPrepAI is a Flask-based study assistant that generates flashcards, quizzes, and answers questions through a chat tutor — powered entirely by a local LLM running through Ollama. There is no cloud API, no API key, and no internet dependency at runtime.

Features


Flashcard generator — enter a topic and get auto-generated Q&A flashcards.
Quiz generator — auto-generated multiple-choice questions with answer keys.
Chat tutor — detects intent (formula, code, derivation, or definition) and tailors the prompt accordingly, so answers stay focused instead of mixing code with theory.
Health check endpoint — verifies Ollama is reachable before generating content.
Fully offline inference — all generation happens locally via Ollama; no data leaves your machine.


Prerequisites


Python 3.11+
Ollama installed locally: https://ollama.com/download
Pull the model used by this project:


   ollama pull phi3:mini


Ollama should be running in the background, listening at http://127.0.0.1:11434 (it usually starts automatically after installation).


Setup

bashcd backend
python -m venv venv
venv\Scripts\activate      # Windows
# source venv/bin/activate # macOS/Linux

pip install -r requirements.txt
python app.py

The app will start at http://127.0.0.1:5000

Project Structure

mini-project/
├── .env                 # environment variables (Ollama host, etc.)
├── README.md
└── backend/
    ├── app.py            # Flask routes: health check, flashcards, quiz, chat
    ├── llm_client.py      # helper utilities for LLM response handling
    ├── requirements.txt
    ├── static/            # JS, CSS, images
    └── templates/         # HTML pages (landing page, login, dashboard)

API Endpoints

EndpointMethodDescription/api/healthGETChecks if Ollama is connected/api/generate_flashcardsPOSTGenerates flashcards for a given topic/api/generate_quizPOSTGenerates an MCQ quiz for a given topic/api/chatPOSTChat tutor with formula/code/derivation detection

Environment Variables

Set in .env:

OLLAMA_HOST=http://127.0.0.1:11434



Tech Stack

Flask · Flask-CORS · Requests · python-dotenv · Ollama (phi3:mini)
