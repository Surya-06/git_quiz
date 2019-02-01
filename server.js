// PRINT STRING RAW USING : JSON.stringinfy(string_value)

const express = require("express"),
  app = express(),
  session = require("express-session"),
  model = require("./model.js"),
  config = require("./config.json"),
  io = require("./QuizIO"),
  bodyParser = require("body-parser"),
  codeExec = require("./codeIO"),
  console_functions = require('./console_functions.js'),
  evaluate = require('./evaluate.js'),
  code_handling = require('./code_handling.js');

var LOG = config.debug ? console.log.bind(console) : function () {};

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded());
app.use(express.static("public"));
app.use(
  session({
    secret: (new Date().getTime() + config.sessionKeyValue).toString()
  })
);

var COUNT = config.questionCount;
var urlencodedParser = bodyParser.urlencoded({
  extended: false
});
var studentMap = new Map(),
  mappedQB = new Map(),
  questionBank = undefined,
  questionsExist = false;


app.post("/login", (req, res) => {
  // getting parameters from login page
  console.log(req.body);
  if (
    req.body.username &&
    req.body.password &&
    !isNaN(req.body.username) &&
    req.body.username >= config.username.lower &&
    req.body.username <= config.username.upper &&
    req.body.password == config.password
  ) {
    req.session.username = req.body.username;
    req.session.password = req.body.password;
    res.statusCode = 200;
    res.redirect("/");
  } else {
    res.render("login.ejs");
  }
});
app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/quiz", (req, res) => {
  if (questionsExist == false) {
    // No quiz since questions do not exist , admin fault
    res.render("error.ejs", {
      context: "Error",
      msg: "Please ask admin to make questions for the Quiz and restart server. :-)"
    });
  }
  LOG("Returning quiz page to : ", req.session.username);
  var questions = getQuestions(COUNT);
  LOG("Starting quiz with questions : ", questions.length);
  let current_student = studentMap.get(req.session.username);
  // If this happens, something might be wrong ( TEST )
  if (current_student == undefined) res.redirect("/login");
  // Adjust code for rendering if there are any problems with < and >
  /*for ( var i=0 ; i<questions.length ; i++ )
        if ( questions[i].code.length > 0 ){
            questions[i].code = questions[i].code.replace("<","&lt;");
            questions[i].code = questions[i].code.replace(">","&gt;");
        }
    */
  // CHECK FOR RELOAD
  LOG("Checks for reload , happen here ");
  if (current_student.submitted == true) {
    res.render("error.ejs", {
      context: "Test completed earlier",
      msg: "Your score = " + current_student.score
    });
  } else if (
    current_student.testStartTime == undefined &&
    current_student.testEndTime == undefined
  ) {
    LOG("Setting start and end times for fresh attempt ");
    current_student.testStartTime = new Date().getTime();
    // Since duration is in minutes , calculating the end time by adding the required amount
    current_student.testEndTime =
      current_student.testStartTime + config.duration * 60 * 1000;
    res.render("quiz.ejs", {
      questions: questions,
      endTime: current_student.testEndTime,
      username: current_student.username
    });
  }
  // see if the current time is ok for the student to continue his test
  else if (new Date().getTime() < current_student.testEndTime) {
    res.render("quiz.ejs", {
      questions: questions,
      endTime: current_student.testEndTime,
      username: current_student.username
    });
  } else {
    res.render("error.ejs", {
      context: "Test completed earlier",
      msg: "Your score = " + current_student.score
    });
  }
});

app.post("/quiz", async (req, res) => {
  LOG("Received answers");
  let current_student = studentMap.get(req.session.username);
  current_student.submitted = true;
  if (current_student.score != undefined) {
    res.render("error.ejs", {
      context: "Error",
      msg: "Test completed earlier , answers cannot be saved. Score : " +
        current_student.score.toString()
    });
  } else {
    var answers = req.body;
    evaluate.eval(answers, current_student, mappedQB);
    LOG("\nEval complete , continuing post");
    res.render("error.ejs", {
      context: "Test complete",
      msg: "Answers saved successfully"
    });
  }
});

app.post("/admin", urlencodedParser, function (req, res) {
  // LOG(req.body);
  io.addQuestions(req.body);
  updateQuestions();
  res.redirect("/admin");
});

app.get("/admin", function (req, res) {
  res.render("admin", {
    cfg: ""
  });
});

app.post("/code", urlencodedParser, function (req, res) {
  var result = codeExec.exec(req.body);
  updateQuestions();
});

app.get("/", (req, res) => {
  if (req.session.username == undefined || req.session.password == undefined) {
    // if username does not exist in the cookies
    res.redirect("/login");
  } else if (studentMap.has(req.session.username)) {
    var current_student = studentMap.get(req.session.username);
    if (current_student.score == undefined) {
      LOG("Making score 0 since previous attempt unsuccessful");
      current_student.score = 0;
    }
    res.render("error.ejs", {
      context: "Error",
      msg: "Test completed earlier , answers cannot be saved. Score : " +
        current_student.score
    });
  } else {
    // user authenticated
    if (
      req.session.username == config.admin.username &&
      req.session.password == config.admin.password
    ) {
      // redirect to input page
      res.redirect("/admin");
    } else {
      // registering student details
      studentMap.set(
        req.session.username,
        new model.student(req.session.username)
      );
      // req.session.destroy() after logout
      res.redirect("/quiz");
    }
  }
});

app.get("/cfg", function (req, res) {
  var cfg = io.fetchCFG();
  res.send(cfg);
});

app.post("/cfg", function (req, res) {
  var cfg = req.body.cfg;
  io.saveCFG(cfg);
  console.log(cfg);
  res.redirect("admin");
});

function getQuestions(count) {
  var questions = [],
    dupQuestions = JSON.parse(JSON.stringify(questionBank));
  for (var i = 0; i < count; i++) {
    var randomIndex = Math.floor(Math.random() * dupQuestions.length);
    questions.push(dupQuestions[randomIndex]);
    dupQuestions.splice(randomIndex, 1);
  }
  return questions;
}

function updateQuestions() {
  let raw_questions = io.fetchQuestions();
  if (raw_questions) {
    questionBank = raw_questions.questions;
    questionsExist = true;
    if (COUNT > questionBank.length) {
      COUNT = questionBank.length;
    }
    for (var i = 0; i < questionBank.length; i++) {
      if (questionBank[i].type == "coding") {
        let questionString = questionBank[i].input.join("\r\n");
        LOG("The value of questionString : \n", questionString);
        questionBank[i].inputFile = code_handling.write_to_file(
          questionString,
          "txt",
          "input_" + questionBank[i].id
        );
        questionBank[i].answer = questionBank[i].answer.join("\r\n");
        questionBank[i].answer = questionBank[i].answer.trim();
      }
      mappedQB.set(questionBank[i].id.toString(), questionBank[i]);
    }
  } else {
    // questions not yet set 
    questionsExist = false;
  }
}

// Handle admin input to server
var stdin = process.openStdin();

stdin.addListener("data", function (command) {
  // convert to usable state
  command = command.toString().trim();
  if (command == "results") {
    console_functions.show_scores(studentMap);
  } else if (command == "help") {
    console_functions.help();
  }
  process.stdout.write(`COMMAND(Type 'help' for help) : `);
});

function initServer() {
  LOG("Initializing server : --- ");
  console.log("Server at port : 3000");
  app.listen(3000);
  updateQuestions();
}

initServer();