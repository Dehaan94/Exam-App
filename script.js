const dom = {
  examSelect: document.getElementById('examSelect'),
  questionText: document.getElementById('questionText'),
  choiceList: document.getElementById('choiceList'),
  questionCount: document.getElementById('questionCount'),
  scoreIndicator: document.getElementById('score'),
  progressFill: document.getElementById('progressFill'),
  checkAnswerButton: document.getElementById('checkAnswer'),
  nextQuestionButton: document.getElementById('nextQuestion'),
  restartQuizButton: document.getElementById('restartQuiz'),
  feedback: document.getElementById('feedback'),
  feedbackText: document.getElementById('feedbackText'),
  explanation: document.getElementById('explanation'),
  summary: document.getElementById('summary'),
};

const state = {
  examSets: [],
  activeExamId: '',
  questions: [],
  currentIndex: 0,
  selectedAnswer: null,
  score: 0,
  topicStats: {},
};

function resetQuestionView() {
  dom.feedback.classList.add('hidden');
  dom.summary.classList.add('hidden');
  state.selectedAnswer = null;
  dom.checkAnswerButton.disabled = false;
  dom.nextQuestionButton.disabled = true;
  dom.choiceList.innerHTML = '';
}

function updateProgress() {
  const total = state.questions.length;
  const progress = total ? ((state.currentIndex + 1) / total) * 100 : 0;
  dom.questionCount.textContent = `${Math.min(state.currentIndex + 1, total)} / ${total}`;
  dom.progressFill.style.width = `${progress}%`;
}

function initTopicStats() {
  state.topicStats = {};
  state.questions.forEach((question) => {
    const topic = question.topic || 'General';
    if (!state.topicStats[topic]) {
      state.topicStats[topic] = { correct: 0, total: 0 };
    }
    state.topicStats[topic].total += 1;
  });
}

function updateTopicStats(topic, isCorrect) {
  if (!state.topicStats[topic]) {
    state.topicStats[topic] = { correct: 0, total: 0 };
  }
  if (isCorrect) {
    state.topicStats[topic].correct += 1;
  }
}

async function loadExamData() {
  try {
    const response = await fetch('data/exam-data.json');
    const data = await response.json();
    state.examSets = data.examSets;
    state.activeExamId = state.examSets[0]?.id || '';
    populateExamSelector();
    startExam(state.activeExamId);
  } catch (error) {
    dom.questionText.textContent = 'Unable to load exam data. Please confirm the data file exists.';
    console.error(error);
  }
}

function populateExamSelector() {
  dom.examSelect.innerHTML = '';
  state.examSets.forEach((exam) => {
    const option = document.createElement('option');
    option.value = exam.id;
    option.textContent = exam.name;
    dom.examSelect.appendChild(option);
  });
  dom.examSelect.value = state.activeExamId;
}

function startExam(examId) {
  const selectedExam = state.examSets.find((exam) => exam.id === examId);
  if (!selectedExam) return;

  state.activeExamId = selectedExam.id;
  state.questions = selectedExam.questions;
  state.currentIndex = 0;
  state.score = 0;
  state.selectedAnswer = null;
  initTopicStats();
  updateScore();
  renderCurrentQuestion();
}

function renderCurrentQuestion() {
  const question = state.questions[state.currentIndex];
  if (!question) return;

  dom.questionText.textContent = `${question.id}. ${question.question}`;
  resetQuestionView();
  updateProgress();

  question.choices.forEach((choiceText) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice-button';
    button.textContent = choiceText;
    button.dataset.choice = choiceText;
    button.addEventListener('click', () => selectChoice(choiceText, button));
    dom.choiceList.appendChild(button);
  });
}

function selectChoice(answer, button) {
  state.selectedAnswer = answer;
  getChoiceButtons().forEach((item) => item.classList.remove('selected'));
  button.classList.add('selected');
}

function updateScore() {
  dom.scoreIndicator.textContent = state.score;
}

function showFeedback(message, details = '') {
  dom.feedbackText.textContent = message;
  dom.explanation.textContent = details;
  dom.feedback.classList.remove('hidden');
}

function getChoiceButtons() {
  return Array.from(dom.choiceList.querySelectorAll('button.choice-button'));
}

function showAnswer() {
  if (!state.selectedAnswer) {
    showFeedback('Please select an option before checking the answer.');
    return;
  }

  const current = state.questions[state.currentIndex];
  getChoiceButtons().forEach((button) => {
    const isCorrect = button.dataset.choice === current.answer;
    const isSelected = button.dataset.choice === state.selectedAnswer;
    button.disabled = true;
    button.classList.toggle('correct', isCorrect);
    button.classList.toggle('incorrect', isSelected && !isCorrect);
  });

  const correct = state.selectedAnswer === current.answer;
  updateTopicStats(current.topic || 'General', correct);

  if (correct) {
    state.score += 1;
    updateScore();
    showFeedback('Correct!', current.explanation);
  } else {
    showFeedback(`Incorrect. Correct answer: ${current.answer}`, current.explanation);
  }

  dom.checkAnswerButton.disabled = true;
  dom.nextQuestionButton.disabled = false;
}

function goToNextQuestion() {
  state.currentIndex += 1;
  if (state.currentIndex >= state.questions.length) {
    showFinalSummary();
    return;
  }
  renderCurrentQuestion();
}

function showFinalSummary() {
  const percent = state.questions.length ? Math.round((state.score / state.questions.length) * 100) : 0;
  dom.questionText.textContent = 'Quiz complete!';
  updateProgress();
  dom.choiceList.innerHTML = '';
  dom.checkAnswerButton.disabled = true;
  dom.nextQuestionButton.disabled = true;
  showFeedback(
    `You finished with ${state.score} correct answer${state.score === 1 ? '' : 's'} out of ${state.questions.length}.`,
    'Use the topic breakdown below to focus your next practice session.'
  );

  const topicItems = Object.entries(state.topicStats)
    .map(([topic, stats]) => {
      const topicPercent = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;
      return `
        <div class="topic-item">
          <div class="topic-meta">
            <span>${topic}</span>
            <strong>${topicPercent}%</strong>
          </div>
          <div class="topic-bar">
            <div class="topic-bar-fill" style="width: ${topicPercent}%"></div>
          </div>
        </div>
      `;
    })
    .join('');

  const passed = percent >= 75;
  dom.summary.innerHTML = `
    <div class="result-head">
      <div>
        <h3>Results</h3>
        <p>Overall score: ${percent}%</p>
        <p class="pass-note">75% or higher is a passing score.</p>
      </div>
      <span class="result-badge ${passed ? 'result-pass' : 'result-fail'}">
        ${passed ? 'Pass' : 'Fail'}
      </span>
    </div>
    <div class="summary-grid">${topicItems}</div>
  `;
  dom.summary.classList.remove('hidden');
}

function restartQuiz() {
  startExam(state.activeExamId);
}

function handleKeyboardNavigation(event) {
  if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return;

  const buttons = getChoiceButtons();
  if (!buttons.length) return;

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    const selectedIndex = buttons.findIndex((button) => button.classList.contains('selected'));
    const nextIndex = selectedIndex === -1 ? 0 : (selectedIndex + 1) % buttons.length;
    buttons[nextIndex].focus();
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    const selectedIndex = buttons.findIndex((button) => button.classList.contains('selected'));
    const nextIndex = selectedIndex === -1 ? buttons.length - 1 : (selectedIndex - 1 + buttons.length) % buttons.length;
    buttons[nextIndex].focus();
  }

  if (event.key === 'Enter') {
    const active = document.activeElement;
    if (active?.classList.contains('choice-button')) {
      active.click();
      return;
    }
    if (!dom.checkAnswerButton.disabled) {
      dom.checkAnswerButton.click();
    }
  }
}

dom.examSelect.addEventListener('change', (event) => {
  startExam(event.target.value);
});
dom.checkAnswerButton.addEventListener('click', showAnswer);
dom.nextQuestionButton.addEventListener('click', goToNextQuestion);
dom.restartQuizButton.addEventListener('click', restartQuiz);
document.addEventListener('keydown', handleKeyboardNavigation);

loadExamData();
