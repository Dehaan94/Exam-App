const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL. Add it to a .env file or environment variables.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

app.use(express.static(path.join(__dirname)));

const gitlabTopicMap = {
  'ci/cd/ct stand for:': 'CI/CD',
  'default initial branch name in new gitlab projects:': 'Branches',
  'primary purpose of gitlab container registry:': 'Repository',
  'purpose of the artifacts keyword:': 'CI/CD',
  'purpose of the rules keyword:': 'CI/CD',
  'the ci_job_id variable is:': 'CI/CD',
  'the ci_job_name variable is:': 'CI/CD',
  'there is one file without which a gitlab pipeline would not exist:': 'CI/CD',
  'what does code owners do?': 'Collaboration',
  'what is a gitlab runner?': 'CI/CD',
  'which feature allows triggering pipelines in another project?': 'CI/CD',
  'which feature tracks large initiatives across multiple projects?': 'Projects',
  'which is not a valid gitlab role?': 'Permissions',
  'which keyword defines the pipeline stages order?': 'CI/CD',
  'which of the following are true about runners?': 'CI/CD',
  'which statements about protected branches are true?': 'Branches',
  'which types of runners can you have in gitlab?': 'CI/CD',
  'which variable contains the full commit sha?': 'Repository',
  'you can override the value of a defined ci/cd variable when you:': 'CI/CD',
  'you can start a downstream pipeline via:': 'CI/CD',
};

const sqlTopicMap = {
  'how can you permanently remove a package from the database in pl/sql?': 'Packages',
  'how do you assign a value to a variable in pl/sql?': 'Variables',
  'how do you create a pl/sql block that can return a value?': 'Blocks',
  'how do you create a pl/sql block that executes only if a certain condition is true?': 'Control Flow',
  'how do you create a pl/sql block that loops over a range of numbers?': 'Loops',
  'how do you declare a cursor in pl/sql?': 'Cursors',
  'how do you handle exceptions in a pl/sql block?': 'Error Handling',
  'what is the default value of a boolean variable in pl/sql if not explicitly initialised?': 'Variables',
  'what is the maximum size of a varchar2 variable?': 'Variables',
  'what is the purpose of the extract function in pl/sql?': 'Functions',
  'what is the purpose of the last_day function in pl/sql?': 'Functions',
  'what is the purpose of the mod function in pl/sql?': 'Functions',
  'what is the purpose of the next_day function in pl/sql?': 'Functions',
  'what is the purpose of the sysdate function in pl/sql?': 'Functions',
  'what is the purpose of the truncate statement in pl/sql?': 'Functions',
  'which of the following is not a valid pl/sql loop construct?': 'Loops',
  'which of the following is not a type of exception?': 'Error Handling',
  'which of the following is not a valid pl/sql block structure?': 'Blocks',
  'which of the following is not a valid pl/sql conditional statement?': 'Control Flow',
  'which of the following is not a valid pl/sql identifier?': 'Syntax',
};

function categorizeGitLabQuestion(question) {
  const key = question.toLowerCase().trim();
  return gitlabTopicMap[key] || 'GitLab Basics';
}

function categorizeSqlQuestion(question) {
  const key = question.toLowerCase().trim();
  return sqlTopicMap[key] || 'PL/SQL Basics';
}

function shuffleArray(items) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function mapRowsToQuestions(rows, categoryFn) {
  const shuffledRows = shuffleArray(rows).slice(0, 20);

  return shuffledRows.map((row, index) => {
    const choices = [row.option1, row.option2, row.option3, row.option4].filter(Boolean);

    return {
      id: index + 1,
      question: row.question,
      choices: shuffleArray(choices),
      answer: row.answer,
      explanation: row.description,
      topic: categoryFn(row.question),
    };
  });
}

async function loadExamSet(tableName, examId, examName, categoryFn) {
  const result = await pool.query(
    `SELECT question, option1, option2, option3, option4, answer, description FROM ${tableName}`
  );
  return {
    id: examId,
    name: examName,
    questions: mapRowsToQuestions(result.rows, categoryFn),
  };
}

app.get('/api/questions', async (req, res) => {
  try {
    const examConfigs = [
      { table: 'gitlabquestions', id: 'gitlab', name: 'GitLab Fundamentals Associate', categoryFn: categorizeGitLabQuestion },
      { table: 'plsqlquestions', id: 'sql', name: 'SQL Fundamentals', categoryFn: categorizeSqlQuestion },
    ];

    const examSets = [];

    for (const config of examConfigs) {
      try {
        const examSet = await loadExamSet(config.table, config.id, config.name, config.categoryFn);
        if (examSet.questions.length) {
          examSets.push(examSet);
        }
      } catch (error) {
        console.warn(`Skipping ${config.name}:`, error.message);
      }
    }

    if (!examSets.length) {
      throw new Error('No exam data available from the database.');
    }

    res.json({ examSets });
  } catch (error) {
    console.error('Error loading questions from the database:', error);
    res.status(500).json({ error: 'Unable to load questions from the database.' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
