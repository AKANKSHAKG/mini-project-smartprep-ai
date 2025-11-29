// --- GLOBALS ---
let currentQuiz = null;
let currentFlashcards = [];
let currentIndex = 0;
let darkMode = localStorage.getItem("theme") === "dark";

// --- DOM ELEMENTS ---
const topicInput = document.getElementById("topicInput");
const flashcardBtn = document.getElementById("generateFlashcardsBtn");
const quizBtn = document.getElementById("generateQuizBtn");
const chatBtn = document.getElementById("chatSendBtn");
const chatInput = document.getElementById("chatInput");
const flashcardContainer = document.getElementById("flashcardsContainer");
const quizContainer = document.getElementById("quizContainer");

// --- UTILS ---
function showNotification(text, type = "info") {
    const note = document.createElement("div");
    note.className = `notification ${type}`;
    note.innerText = text;
    document.body.appendChild(note);
    setTimeout(() => note.remove(), 2500);
}

async function handleBackoff(fn, retry = 4) {
    for (let i = 0; i < retry; i++) {
        try {
            return await fn();
        } catch (err) {
            console.warn(`⏳ Retry ${i + 1}/${retry}...`);
            await new Promise(res => setTimeout(res, 800 * (i + 1)));
        }
    }
    throw new Error("Server didn't respond");
}

// ------------------ FLASHCARDS ------------------
async function generateFlashcards() {
    const topic = topicInput.value.trim();
    if (!topic) return showNotification("Enter topic!", "error");

    showNotification("Generating flashcards...", "info");

    try {
        const data = await handleBackoff(() =>
            fetch("/api/generate_flashcards", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ topic })
            }).then(r => r.json())
        );

        if (!data.success) throw new Error(data.error);

        currentFlashcards = parseFlashcards(data.flashcards_text, topic);
        currentIndex = 0;

        if (currentFlashcards.length === 0) {
            showNotification("Couldn't parse flashcards", "error");
            return;
        }

        displayFlashcard();
        showNotification("Flashcards ready ✅", "success");
    } catch {
        showNotification("AI timeout. Try again.", "error");
    }
}

function displayFlashcard() {
    const [q, a] = currentFlashcards[currentIndex];
    flashcardContainer.innerHTML = `
        <div class="flashcard">
            <p><b>Q:</b> ${q}</p>
            <p class="answer" style="display:none"><b>A:</b> ${a}</p>
            <button id="revealBtn">Reveal</button>
            <button id="nextBtn">Next</button>
        </div>
    `;

    document.getElementById("revealBtn").onclick = () =>
        flashcardContainer.querySelector(".answer").style.display = "block";

    document.getElementById("nextBtn").onclick = () => {
        currentIndex = (currentIndex + 1) % currentFlashcards.length;
        displayFlashcard();
    };
}

// ------------------ QUIZ (STREAMING) ------------------
async function generateQuiz() {
    const topic = topicInput.value.trim();
    if (!topic) return showNotification("Enter topic!", "error");

    showNotification("Generating quiz...", "info");

    try {
        const response = await fetch('/api/generate_quiz_stream', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topic })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let text = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            text += decoder.decode(value, { stream: true });
        }

        currentQuiz = parseQuiz(text, topic);

        if (!currentQuiz || currentQuiz.questions.length === 0) {
            return showNotification("Couldn't parse quiz. Try again.", "error");
        }

        displayQuiz();
        showNotification("Quiz Ready ✅", "success");
    } catch (e) {
        console.error(e);
        showNotification("Timeout / LLM slow. Try again.", "error");
    }
}

function displayQuiz() {
    quizContainer.innerHTML = "";
    currentQuiz.questions.forEach((q, idx) => {
        const card = document.createElement("div");
        card.className = "quiz-card";

        card.innerHTML = `
            <p><b>Q${idx + 1}:</b> ${q.question}</p>
            ${q.options.map((opt, i) => `
                <button class="quiz-opt" data-q="${idx}" data-opt="${String.fromCharCode(65 + i)}">
                    ${String.fromCharCode(65 + i)}. ${opt}
                </button>
            `).join("")}
            <p class="answer-text" style="display:none; color:green;">
                ✅ Correct: ${q.answer}
            </p>
        `;
        quizContainer.appendChild(card);
    });

    document.querySelectorAll(".quiz-opt").forEach(btn => {
        btn.onclick = () => {
            const correct = currentQuiz.questions[btn.dataset.q].answer;
            const ansText = btn.parentElement.querySelector(".answer-text");
            ansText.style.display = "block";

            if (btn.dataset.opt === correct) {
                btn.style.background = "#4caf50";
            } else {
                btn.style.background = "#e53935";
            }
        };
    });
}

// ------------------ CHAT ------------------
async function sendChat() {
    const msg = chatInput.value.trim();
    if (!msg) return;

    showNotification("Thinking...", "info");
    chatBtn.disabled = true;

    try {
        const data = await handleBackoff(() =>
            fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: msg })
            }).then(r => r.json())
        );

        showNotification(data.response || "No reply", "success");
    } catch {
        showNotification("Chat failed. Try again.", "error");
    }

    chatBtn.disabled = false;
    chatInput.value = "";
}

// ------------------ THEME SWITCH ------------------
function toggleTheme() {
    darkMode = !darkMode;
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    localStorage.setItem("theme", darkMode ? "dark" : "light");
}
document.getElementById("themeToggle").onclick = toggleTheme;

// ------------------ EVENT LISTENERS ------------------
flashcardBtn.onclick = generateFlashcards;
quizBtn.onclick = generateQuiz;
chatBtn.onclick = sendChat;
chatInput.addEventListener("keypress", (e) => e.key === "Enter" && sendChat());

// ✅ Apply theme on load
document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
