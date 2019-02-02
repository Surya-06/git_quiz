// PRINT STRING RAW USING : JSON.stringinfy(string_value)

const express = require("express"),
  app = express(),
  session = require("express-session"),
  model = require("./libs/model.js"),
  config = require("./config.json"),
  io = require("./libs/QuizIO"),
  bodyParser = require("body-parser"),
  codeExec = require("./libs/codeIO"),
  console_functions = require('./libs/console_functions.js'),
  evaluate = require('./libs/evaluate.js'),
  questionHandler = require('./libs/question_handler.js'),
  authenticationHandler = require('./libs/authenticationHandler.js');

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

// MAIN PAGE ACCESS 
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
      res.redirect("/admin_main");
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

// POST FROM THE CODE PAGE 
app.post("/code", urlencodedParser, function (req, res) {
  var result = codeExec.exec(req.body);
  let question_return_values = questionHandler.updateQuestions(COUNT, questionBank, mappedQB);
  questionsExist = question_return_values.questionsExist,
    questionBank = question_return_values.questionBank,
    mappedQB = question_return_values.mappedQB,
    COUNT = question_return_values.count;
});

// GET FOR CONFIGURATION PAGE 
app.get("/cfg", authenticationHandler.checkAuthentication, function (req, res) {
  var cfg = io.fetchCFG();
  res.send(cfg);
});

// POST FOR CONFIGURATION PAGE 
app.post("/cfg", function (req, res) {
  var cfg = req.body.cfg;
  io.saveCFG(cfg);
  console.log(cfg);
  res.redirect("admin_question_input");
});

// HANDLE INVALID AUTHENTICATION 
app.use("/cfg", authenticationHandler.errorRedirect);

// GET FROM THE ADMIN QUESTION PAGE 
app.get("/admin_question_input", authenticationHandler.checkAuthentication, function (req, res) {
  res.render("admin_question_input", {
    cfg: ""
  });
});

// POST FROM THE ADMIN QUESTION PAGE 
app.post("/admin_question_input", urlencodedParser, function (req, res) {
  // LOG(req.body);
  io.addQuestions(req.body);
  let question_return_values = questionHandler.updateQuestions(COUNT, questionBank, mappedQB);
  questionsExist = question_return_values.questionsExist,
    questionBank = question_return_values.questionBank,
    mappedQB = question_return_values.mappedQB,
    COUNT = question_return_values.count;
  res.redirect("/login");
});

// HANDLE INVALID AUTHENTICATION
app.use("/admin_question_input", authenticationHandler.errorRedirect);

// GET FOR QUIZ DATA PAGE 
app.get("/quiz", authenticationHandler.checkAuthentication, (req, res) => {
  if (questionsExist == false) {
    // No quiz since questions do not exist , admin fault
    res.render("error.ejs", {
      context: "Error",
      msg: "Please ask admin to make questions for the Quiz and restart server. :-)"
    });
  }
  LOG("Returning quiz page to : ", req.session.username);
  var questions = questionHandler.getQuestions(COUNT, questionBank);
  LOG("Starting quiz with questions : ", questions.length);
  let current_student = studentMap.get(req.session.username);
  // If this happens, something might be wrong ( TEST )
  if (current_student == undefined) res.redirect("/login");
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

// POST FROM THE QUIZ DATA PAGE 
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

// INVALID AUTHENTICATION
app.use("/quiz", authenticationHandler.errorRedirect);

// GET FOR LOGIN PAGE
app.get("/login", (req, res) => {
  res.render("login.ejs");
});

// POST AFTER LOGIN 
app.post("/login", (req, res) => {
  LOG(req.body);
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
  } else if (req.body.username == config.admin.username && req.body.password == config.admin.password) {
    req.session.username = req.body.username;
    req.session.password = req.body.password;
    res.redirect("/admin_main");
    return;
  } else {
    res.render("login.ejs");
    return;
  }
});

// GET FOR ADMIN PAGE 
app.get('/admin_main', authenticationHandler.checkAuthentication, (req, res) => {
  res.render('admin_main.ejs', {
    studentDetails: studentMap
  });
  return;
});

// POST FOR ADMIN PAGE 
app.post('/admin_main', (req, res) => {
  res.redirect('/login');
  return;
});

// HANDLE INVALID AUTHENTICATION
app.use("/admin_main", authenticationHandler.errorRedirect);

function initServer() {
  LOG("Initializing server : --- ");
  console.log("Server at port : 3000");
  app.listen(3000);
  let question_return_values = questionHandler.updateQuestions(COUNT, questionBank, mappedQB);
  questionsExist = question_return_values.questionsExist,
    questionBank = question_return_values.questionBank,
    mappedQB = question_return_values.mappedQB,
    COUNT = question_return_values.count;
  console_functions.activateConsoleFunctions(studentMap);
}

initServer();