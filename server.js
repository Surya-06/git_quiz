// START WITH  COMMAND : node server.js
// Type : studentMap : Map ( username , Model.student )

const express = require("express"),
  app = express(),
  session = require("express-session"),
  model = require("./libs/model.js"),
  io = require("./libs/QuizIO"),
  bodyParser = require("body-parser"),
  fs = require('fs'),
  codeExec = require("./libs/codeIO"),
  console_functions = require("./libs/console_functions.js"),
  evaluate = require("./libs/evaluate.js"),
  questionHandler = require("./libs/question_handler.js"),
  authenticationHandler = require("./libs/authenticationHandler.js"),
  multer = require("multer"),
  storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, __dirname + "/public/images");
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname);
    }
  }),
  upload = multer({
    storage: storage
  });

var config = require("./config.json");
// var config = fs.readFileSync('./config.json', 'utf-8');
var LOG = config.debug ? console.log.bind(console) : function () {};

var MASTER_RESPONSE_CONTROL_TAKE_INPUTS = true;
var section = "",
  subject = "";

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded());
app.use(express.static("public"));
app.use(
  session({
    secret: (new Date().getTime() + config.sessionKeyValue).toString()
  })
);

var COUNT = config.questionCount,
  urlencodedParser = bodyParser.urlencoded({
    extended: false
  }),
  studentMap = new Map(),
  mappedQB = new Map(),
  questionBank = undefined,
  questionsExist = false,
  namesMap = new Map();

// MAIN PAGE ACCESS
app.get("/", (req, res) => {
  if (req.session.username == undefined || req.session.password == undefined) {
    // if username does not exist in the cookies
    req.session.loginComplete = false;
    res.redirect("/login");
  } else if (studentMap.has(req.session.username)) {
    res.redirect("/quiz");
    return;
  } else {
    // user authenticated
    if (
      req.session.username == config.admin.username &&
      req.session.password == config.admin.password
    ) {
      // redirect to input page
      res.redirect("/admin_main");
    } else {
      // registering student details if test is open
      if (MASTER_RESPONSE_CONTROL_TAKE_INPUTS) {
        let name = namesMap.get(req.session.username) ?
          namesMap.get(req.session.username) :
          "No name";
        studentMap.set(
          req.session.username,
          new model.student(req.session.username, name)
        );
        // req.session.destroy() after logout
        // The student receives the quiz for the first time from here 
        res.redirect('/rules');
        // res.redirect("/quiz");
      } else {
        res.redirect('/quiz');
      }
    }
  }
});

// GET THE RULES PAGE 
app.get('/rules', authenticationHandler.checkAuthentication, (req, res) => {
  res.render('rules.ejs', {
    rules: config.rules,
    rule_time: config.rule_time
  });
  return;
});

// POST FROM RULES PAGE
app.post('/rules', authenticationHandler.checkAuthentication, (req, res) => {

});

// INVALID REQUESTS TO RULES PAGE
app.use('/rules', authenticationHandler.errorRedirect);

// POST FROM THE CODE PAGE
app.post("/code", urlencodedParser, (req, res) => {
  var result = codeExec.exec(req.body);
  let question_return_values = questionHandler.updateQuestions(
    COUNT,
    questionBank,
    mappedQB
  );
  (questionsExist = question_return_values.questionsExist),
  (questionBank = question_return_values.questionBank),
  (mappedQB = question_return_values.mappedQB),
  (COUNT = question_return_values.count);
});

// GET FOR CONFIGURATION PAGE
app.get("/cfg", authenticationHandler.checkAuthentication, (req, res) => {
  var cfg = io.fetchCFG();
  res.send(cfg);
});

// POST FOR CONFIGURATION PAGE
app.post("/cfg", authenticationHandler.checkAuthentication, (req, res) => {
  var cfg = req.body.cfg;
  io.saveCFG(cfg);
  console.log(cfg);
  if (studentMap.size == 0) {
    console.log('Configuration updated safely');
    config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
  } else
    console.log('Configuration could not be updated due to ' + studentMap.size + ' students');
  LOG('updated value of usernames : ' + config.username.lower + '  ' + config.username.upper);
  res.redirect("admin_question_input");
});

// HANDLE INVALID AUTHENTICATION
app.use("/cfg", authenticationHandler.errorRedirect);

// GET FROM THE ADMIN QUESTION PAGE
app.get("/admin_question_input", authenticationHandler.checkAuthentication, (req, res) => {
  var q = io.fetchQuestions();
  res.render("admin_question_input", {
    cfg: "",
    questions: q.questions
  });
});

// POST FROM THE ADMIN QUESTION PAGE
app.post("/admin_question_input", upload.single("img"), authenticationHandler.checkAdminAuthentication, urlencodedParser, (req, res) => {
  // LOG(req.body);
  var questionJson = req.body;
  if (req.file) {
    questionJson.img = req.file.originalname;
  }
  io.addQuestions(questionJson);
  let question_return_values = questionHandler.updateQuestions(
    COUNT,
    questionBank,
    mappedQB
  );
  (questionsExist = question_return_values.questionsExist),
  (questionBank = question_return_values.questionBank),
  (mappedQB = question_return_values.mappedQB),
  (COUNT = question_return_values.count);
  res.redirect("/admin_question_input");
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
  // Take inputs as long as the value is true
  if (MASTER_RESPONSE_CONTROL_TAKE_INPUTS) {
    LOG("Returning quiz page to : ", req.session.username);
    let questions = questionHandler.getQuestions(COUNT, questionBank);
    LOG("Starting quiz with questions : ", questions.length);
    let current_student = studentMap.get(req.session.username);
    LOG("Checks for reload , happen here ");
    if (current_student.testAttempted == true) {
      if (current_student.score == undefined) {
        //TODO : SUBMIT SCORE BEFORE RELOAD HANDLING
        current_student.score = 0;
        current_student.flag = current_student.flagValues["reload"];
      }
      if (current_student.testEndTime == undefined) {
        // RELOAD CASE
        current_student.flag = current_student.flagValues["reload"];
        current_student.testEndTime = new Date();
      }

      let msg_detail = '';
      if (config.show_results_before_end)
        msg_detail = "Your score = " + current_student.score;
      else
        msg_detail = "Your attempt has been saved successfully"

      res.render("error.ejs", {
        context: "Test completed earlier",
        msg: msg_detail
      });
    } else if (current_student.testAttempted == false) {
      LOG("Setting quiz up for new attempt");
      current_student.testDuration = config.duration;
      current_student.testAttempted = true;
      current_student.testStartTime = new Date();
      res.render("quiz.ejs", {
        questions: questions,
        endTime: config.duration,
        username: current_student.username,
        name: current_student.name,
        section: section,
        subject: subject
      });
    } else {
      let msg_detail = '';
      if (config.show_results_before_end)
        msg_detail = "Your score = " + current_student.score;
      else
        msg_detail = "Your attempt has been saved successfully"

      res.render("error.ejs", {
        context: "Test completed earlier",
        msg: msg_detail
      });
    }
  } else {
    let student = studentMap.get(req.session.username);
    LOG(student)
    if (student != undefined) {
      res.render("resultEnd.ejs", {
        context: "Test completed earlier",
        msg: "Your score = " + student.score
      });
      return;
    } else {
      res.render("error.ejs", {
        context: "Test Ended By Faculty",
        msg: "Test duration complete"
      });
      return;
    }
  }
});

// POST FROM THE QUIZ DATA PAGE
app.post("/quiz", authenticationHandler.checkAuthentication, async (req, res) => {
  LOG("Received answers");
  let current_student = studentMap.get(req.session.username);
  current_student.testAttempted = true;
  current_student.testEndTime = new Date();
  LOG("Student : ", current_student.username);
  LOG("End Time : ", current_student.testEndTime);
  if (current_student.score != undefined) {
    res.render("error.ejs", {
      context: "Test completed successfully",
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
  if (req.session.loginComplete == false) {
    LOG("first time login");
    res.render("login.ejs", {
      name: quiz_name
    });
  } else {
    LOG("PREV LOGIN COMPLETE");
    res.redirect("/");
  }
  return;
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
    req.session.loginComplete = true;
    res.redirect("/");
  } else if (
    req.body.username == config.admin.username &&
    req.body.password == config.admin.password
  ) {
    req.session.username = req.body.username;
    req.session.password = req.body.password;
    res.redirect("/admin_main");
    return;
  } else {
    res.render("login.ejs", {
      name: quiz_name
    });
    return;
  }
});

// GET FOR ADMIN PAGE
app.get("/admin_main", authenticationHandler.checkAdminAuthentication, (req, res) => {
  if (
    req.session.username == config.admin.username &&
    req.session.password == config.admin.password
  ) {
    // var s = "";
    // for(let i of studentMap.keys()){
    //   s += JSON.stringify(studentMap.get(i));
    // }
    // res.send(s);
    res.render("admin_main.ejs", {
      studentDetails: studentMap
    });
    return;
  } else {
    res.render("error.ejs", {
      context: "Invalid authentication",
      msg: "Please use valid authentication to access page"
    });
    return;
  }
});

// POST FOR ADMIN PAGE
app.post("/admin_main", authenticationHandler.checkAdminAuthentication, (req, res) => {
  res.redirect("/login");
  return;
});

// POST FOR UPDATE QUESTIONS
app.post("/updateQuestions", authenticationHandler.checkAdminAuthentication, (req, res) => {
  io.saveQuestions(req.body);
  let question_return_values = questionHandler.updateQuestions(
    COUNT,
    questionBank,
    mappedQB
  );
  (questionsExist = question_return_values.questionsExist),
  (questionBank = question_return_values.questionBank),
  (mappedQB = question_return_values.mappedQB),
  (COUNT = question_return_values.count);
  res.redirect("/admin_question_input");
});

// HANDLE INVALID AUTHENTICATION
app.use("/admin_main", authenticationHandler.errorRedirect);
app.use("/updateQuestions", authenticationHandler.errorRedirect);

// GET FOR DOWNLOAD RESULTS PAGE
app.get("/downloadResult", authenticationHandler.checkAdminAuthentication, (req, res) => {
  LOG("Request received");
  let filePath = console_functions.writeToExcel(studentMap, COUNT);
  res.download(__dirname + "\\" + filePath);
});

// HANDLE INVALID AUTHENTICATION
app.use("/downloadResult", authenticationHandler.errorRedirect);

// HANDLE TEST END
app.get("/endTest", authenticationHandler.checkAdminAuthentication, (req, res) => {
  LOG("Ending test responses ");
  MASTER_RESPONSE_CONTROL_TAKE_INPUTS = false;
  res.render("error.ejs", {
    context: "Test ended",
    msg: "Evaluated students can see their answers."
  })
});

app.use('/endTest', authenticationHandler.errorRedirect);

// POST HANDLING FOR DELETE QUESTION PAGE
app.post("/deleteQuestion", authenticationHandler.checkAdminAuthentication, (req, res) => {
  var id = req.body.id;
  var data = io.fetchQuestions();

  for (var i = 0; i < data.questions.length; i++) {
    if (id == data.questions[i].id) {
      data.questions.splice(i, 1);
      break;
    }
  }

  io.saveQuestions(data);
  res.redirect("/admin_question_input");
});

// HANDLE INVALID AUTHENTICATION
app.use('deleteQuestion', authenticationHandler.errorRedirect);

// Restart attempt handling 
app.get('/restartAttempt', authenticationHandler.checkAdminAuthentication, (req, res) => {
  let current_student = studentMap.get(req.query.id);
  current_student.resetStats();
  res.render('shiftError.ejs', {
    context: 'Setting changed',
    msg: 'Re-attempt activated',
    link: 'admin_main'
  });
  return;
});

app.get('/studentResult', authenticationHandler.checkAuthentication, (req, res) => {
  let username = req.session.username;
  let studentData = studentMap.get(username);
  if (studentData) {
    res.render('results.ejs', {
      questions: studentData.answers,
      id: req.session.username
    });
  } else {
    res.render("error.ejs", {
      context: "Evalution not complete / Record doesn't exist",
      msg: "Please contact admin for details"
    })
  }
});

app.use('/studentResult', authenticationHandler.errorRedirect);

app.get('/results', authenticationHandler.checkAdminAuthentication, (req, res) => {
  var id = req.query.id;
  var studentData = studentMap.get(id);


  if (studentData != undefined) {
    res.render("results.ejs", {
      questions: studentData.answers,
      id: id
    });
  } else {
    res.render('admin_main.ejs', {
      studentDetails: studentMap
    });
    return;
  }
  console_functions.generatePDF(studentData);
});

app.use('/results', authenticationHandler.errorRedirect);

app.get('/downloadPdf', authenticationHandler.checkAuthentication, (req, res) => {
  LOG("Received download request from the web");
  let userData = studentMap.get(req.session.username);
  if (userData) {
    let filePath = console_functions.generatePDF(userData);
    res.download(__dirname + "\\" + filePath);
    return;
  } else {
    res.render('error.ejs', {
      context: 'No valid records found.',
      msg: 'Please contact admin.'
    });
    return;
  }
});

app.use('/downloadPdf', authenticationHandler.errorRedirect);

app.use("/restartAttempt", authenticationHandler.errorRedirect);

async function initServer() {
  LOG("Initializing server : --- ");
  console.log("Server at port : 3000");

  quiz_name = await console_functions.takeUserInput('Please enter QUIZ NAME :');
  console_functions.modPDFPath(quiz_name);
  console.log('Quiz name configured');
  section = await console_functions.takeUserInput('Please enter SECTION NAME : ');
  console.log('Section name configured');
  subject = await console_functions.takeUserInput('Please enter the SUBJECT NAME : ', true);
  console.log("Subject name configured");

  app.listen(3000);
  let question_return_values = questionHandler.updateQuestions(
    COUNT,
    questionBank,
    mappedQB
  );
  namesMap = console_functions.getNamesFromExcel();
  (questionsExist = question_return_values.questionsExist),
  (questionBank = question_return_values.questionBank),
  (mappedQB = question_return_values.mappedQB),
  (COUNT = question_return_values.count);
  console_functions.activateConsoleFunctions(studentMap);
  LOG('Current save interval is  : ' + config.saveInterval);
  // Activate periodic save to excel file
  setInterval(() => {
    console_functions.writeToExcel(studentMap, COUNT);
    for (let student of studentMap.keys())
      console_functions.generatePDF(studentMap.get(student));
  }, Number.parseInt(config.saveInterval) * 60000);

  LOG('SERVER ACTIVELY LISTENETING FOR REQUESTS , INITIALIZATION COMPLETE');
}

initServer();