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
  timerDisplay: document.getElementById('timerDisplay'),
  startTimerButton: document.getElementById('startTimer'),
};

const state = {
  examSets: [],
  activeExamId: '',
  questions: [],
  currentIndex: 0,
  selectedAnswers: [],
  score: 0,
  topicStats: {},
  timerSeconds: 0,
  timerInterval: null,
  timerRunning: false,
};

function resetQuestionView() {
  dom.feedback.classList.add('hidden');
  dom.summary.classList.add('hidden');
  state.selectedAnswers = [];
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

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function shuffleArray(items) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function buildShuffledQuestions(questions) {
  return shuffleArray(questions).map((question) => ({
    ...question,
    choices: shuffleArray(question.choices || []),
  }));
}

function updateTimerDisplay() {
  dom.timerDisplay.textContent = formatTime(state.timerSeconds);
}

function resetTimer() {
  clearInterval(state.timerInterval);
  state.timerSeconds = 0;
  state.timerRunning = false;
  state.timerInterval = null;
  updateTimerDisplay();
  dom.startTimerButton.disabled = false;
  dom.startTimerButton.textContent = 'Start';
}

function startTimer() {
  if (state.timerRunning) return;
  state.timerRunning = true;
  dom.startTimerButton.disabled = true;
  dom.startTimerButton.textContent = 'Running';
  state.timerInterval = setInterval(() => {
    state.timerSeconds += 1;
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  if (!state.timerRunning) return;
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  state.timerRunning = false;
  updateTimerDisplay();
}

async function loadExamData() {
  try {
    const response = await fetch('/api/questions', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }
    const data = await response.json();
    state.examSets = data.examSets;
    state.activeExamId = state.examSets[0]?.id || '';
    populateExamSelector();
    startExam(state.activeExamId);
  } catch (error) {
    dom.questionText.textContent = 'Unable to load exam data. Please confirm the backend server is running and connected to the database.';
    console.error(error);
  }
}

function populateExamSelector() {
  const displayNames = {
    gitlab: 'GitLab Fundamentals Associate',
    sql: 'PostgreSQL Fundamentals',
  };

  dom.examSelect.innerHTML = '';
  state.examSets.forEach((exam) => {
    const option = document.createElement('option');
    option.value = exam.id;
    option.textContent = displayNames[exam.id] || exam.name;
    dom.examSelect.appendChild(option);
  });
  dom.examSelect.value = state.activeExamId;
}

function startExam(examId) {
  const selectedExam = state.examSets.find((exam) => exam.id === examId);
  if (!selectedExam) return;

  state.activeExamId = selectedExam.id;
  state.questions = buildShuffledQuestions(selectedExam.questions);
  state.currentIndex = 0;
  state.score = 0;
  initTopicStats();
  resetTimer();
  updateScore();
  renderCurrentQuestion();
}

function normalizeChoiceValue(value) {
  return String(value ?? '').trim().toLowerCase();
}

function resolveAnswerValue(value, choices) {
  const trimmedValue = String(value ?? '').trim();
  if (!trimmedValue) return '';

  const directMatch = choices.find((choice) => normalizeChoiceValue(choice) === normalizeChoiceValue(trimmedValue));
  if (directMatch) return directMatch;

  const letterMatch = trimmedValue.match(/^[a-d]$/i);
  if (letterMatch) {
    const index = trimmedValue.toLowerCase().charCodeAt(0) - 97;
    return choices[index] || trimmedValue;
  }

  return trimmedValue;
}

function getCorrectAnswers(question) {
  const rawAnswer = question?.answer;
  const choices = question?.choices || [];

  if (Array.isArray(rawAnswer)) {
    return rawAnswer.map((answer) => resolveAnswerValue(answer, choices));
  }

  const answerText = String(rawAnswer ?? '').trim();
  if (!answerText) {
    return [];
  }

  const tokens = answerText
    .split(/\s*(?:,|;|\||\band\b)\s*/i)
    .map((token) => token.trim())
    .filter(Boolean);

  return tokens.map((token) => resolveAnswerValue(token, choices));
}

function hasMultipleCorrectAnswers(question) {
  return getCorrectAnswers(question).length > 1;
}

function answersMatch(selectedAnswers, correctAnswers) {
  const normalizedSelected = selectedAnswers.map((answer) => normalizeChoiceValue(answer)).sort();
  const normalizedCorrect = correctAnswers.map((answer) => normalizeChoiceValue(answer)).sort();

  return normalizedSelected.length === normalizedCorrect.length && normalizedSelected.every((answer, index) => answer === normalizedCorrect[index]);
}

function renderCurrentQuestion() {
  const question = state.questions[state.currentIndex];
  if (!question) return;

  const multiSelectLabel = hasMultipleCorrectAnswers(question) ? ' (Select all that apply)' : '';
  dom.questionText.textContent = `${state.currentIndex + 1}. ${question.question}${multiSelectLabel}`;
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
  const current = state.questions[state.currentIndex];
  const multiSelect = hasMultipleCorrectAnswers(current);

  if (multiSelect) {
    const alreadySelected = state.selectedAnswers.includes(answer);
    if (alreadySelected) {
      state.selectedAnswers = state.selectedAnswers.filter((item) => item !== answer);
    } else {
      state.selectedAnswers.push(answer);
    }
    button.classList.toggle('selected', state.selectedAnswers.includes(answer));
    return;
  }

  state.selectedAnswers = [answer];
  getChoiceButtons().forEach((item) => item.classList.remove('selected'));
  button.classList.add('selected');
}

function updateScore() {
  dom.scoreIndicator.textContent = state.score;
}

function formatFeedbackMessage(message) {
  if (message.startsWith('Incorrect.')) {
    return message.replace(/^Incorrect\./, '<span class="error-word">Incorrect.</span>');
  }
  if (message.startsWith('Correct!')) {
    return message.replace(/^Correct!/, '<span class="success-word">Correct!</span>');
  }
  return message;
}

function showFeedback(message, details = '') {
  const formattedMessage = formatFeedbackMessage(message);

  if (formattedMessage !== message) {
    dom.feedbackText.innerHTML = formattedMessage;
  } else {
    dom.feedbackText.textContent = message;
  }
  dom.explanation.textContent = details;
  dom.feedback.classList.remove('hidden');
}

function getChoiceButtons() {
  return Array.from(dom.choiceList.querySelectorAll('button.choice-button'));
}

function showAnswer() {
  if (!state.selectedAnswers.length) {
    showFeedback('Please select an option before checking the answer.');
    return;
  }

  const current = state.questions[state.currentIndex];
  const correctAnswers = getCorrectAnswers(current);
  const multiSelect = hasMultipleCorrectAnswers(current);

  getChoiceButtons().forEach((button) => {
    const isCorrectChoice = correctAnswers.some((answer) => normalizeChoiceValue(answer) === normalizeChoiceValue(button.dataset.choice));
    const isSelected = state.selectedAnswers.some((answer) => normalizeChoiceValue(answer) === normalizeChoiceValue(button.dataset.choice));
    button.disabled = true;
    button.classList.toggle('correct', isCorrectChoice);
    button.classList.toggle('incorrect', isSelected && !isCorrectChoice);
  });

  const correct = answersMatch(state.selectedAnswers, correctAnswers);
  updateTopicStats(current.topic || 'General', correct);

  if (correct) {
    state.score += 1;
    updateScore();
    showFeedback('Correct!', current.explanation);
  } else if (multiSelect) {
    showFeedback(`Incorrect. Correct answers: ${correctAnswers.join(', ')}`, current.explanation);
  } else {
    showFeedback(`Incorrect. Correct answer: ${correctAnswers[0] || current.answer}`, current.explanation);
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
  stopTimer();
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

  const topicData = getSortedTopicData();
  const topTopics = topicData.slice(0, 5);

  const topicItems = buildTopicItems(topTopics);
  const improvementSection = buildImprovementSection(topTopics);

  const passed = percent >= 75;
  const timeTaken = formatTime(state.timerSeconds);
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
    <div class="summary-details">
      <p>You completed the exam in <strong>${timeTaken}</strong>.</p>
      <p>Your performance by topic is shown below.</p>
      <div class="summary-grid">${topicItems}</div>
      ${improvementSection}
    </div>
  `;
  dom.summary.classList.remove('hidden');
}

function getSortedTopicData() {
  return Object.entries(state.topicStats)
    .map(([topic, stats]) => {
      const percent = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;
      return {
        topic,
        percent,
        correct: stats.correct,
        total: stats.total,
        needsImprovement: percent < 75,
      };
    })
    .sort((a, b) => {
      if (a.needsImprovement !== b.needsImprovement) {
        return a.needsImprovement ? -1 : 1;
      }
      if (a.percent !== b.percent) {
        return a.percent - b.percent;
      }
      return b.total - a.total;
    });
}

function buildTopicItems(topTopics) {
  return topTopics
    .map(({ topic, percent, correct, total }) => `
      <div class="topic-item">
        <div class="topic-meta">
          <span>${topic}</span>
          <strong>${percent}%</strong>
        </div>
        <div class="topic-bar">
          <div class="topic-bar-fill" style="width: ${percent}%"></div>
        </div>
        <div class="topic-summary">${correct} / ${total} correct</div>
      </div>
    `)
    .join('');
}

function buildImprovementSection(topTopics) {
  const improvementItems = topTopics
    .filter((topic) => topic.needsImprovement)
    .map((topic) => `<li>${topic.topic}: ${topic.correct} / ${topic.total} correct (${topic.percent}%)</li>`)
    .join('');

  return improvementItems
    ? `<div class="focus-section">
         <h4>Areas to improve</h4>
         <p>Focus your next practice on the topics below:</p>
         <ul class="focus-list">${improvementItems}</ul>
       </div>`
    : `<div class="focus-section focus-good">
         <h4>Great work!</h4>
         <p>You scored 75% or higher in all topics.</p>
       </div>`;
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
dom.startTimerButton.addEventListener('click', startTimer);
document.addEventListener('keydown', handleKeyboardNavigation);

loadExamData();
