const code_handling = require('./code_handling.js'),
  config = require("../config.json"),
  model = require('./model.js');

var LOG = config.debug ? console.log.bind(console) : function () {};

function compareArray(a, b) {
  for (var i = 0; i < a.length; i++) {
    if (a[i] != b[i]) {
      return false;
    }
  }
  return true;
}

async function eval(answers, student, mappedQB) {
  student.score = 0;
  LOG("Evaluating answers");
  for (var i in answers) {
    if (i == 'flag') {
      student.flag = student.flagValues[i];
      continue;
    }
    let question = mappedQB.get(i);
    let responseList = new model.questionResponse(question.question, answers[i], question.answer);
    if (question.type == 'multi' || question.type == 'fill' || question.type == 'match') {
      responseList.addCode(question.code);
    }
    student.answers.push(responseList);
    let negative = false;
    if (question.type == "match") {
      if (compareArray(question.answer, answers[i])) {
        student.score += config.pointsPerQuestion;
      } else if (config.negativeMarking) negative = true;
      LOG("Score after matching question : " + student.score);
    } else if (question.type == "coding") {
      LOG("Coding question");
      if (question.lang == "cpp") {
        let executionPromise = code_handling.execCode(
          answers[i],
          question.lang,
          student.username,
          i,
          question.inputFile
        );
        LOG("Waiting for execution promise");
        executionPromise.then(
          result => {
            if (result == false) LOG("The execution generated error ! ", id);
            else {
              LOG("Execution complete : ");
              LOG("Result : \n", result);
              LOG("Expected : \n", question.answer);
              if (result == question.answer) {
                student.score += config.pointsPerQuestion;
                LOG("Updated score of student is " + student.score.toString());
              } else if (config.negativeMarking) {
                negative = true;
              } else {
                LOG(
                  "Eval complete for code , no change in marks of student : " +
                  student.username +
                  " " +
                  student.score
                );
              }
            }
          },
          error => {
            LOG("Error occured during processing -- HANDLE ADMIN , ", i);
          }
        );
      } else if (question.lang == "python") {
        // handle python code
        let executionPromise = code_handling.execCode(
          answers[i],
          question.lang,
          student.username,
          i,
          question.inputFile
        );
        LOG("Waiting for execution promise");
        executionPromise.then(
          result => {
            if (result == false) LOG("The execution generated error ! ", id);
            else {
              LOG("Execution complete");
              LOG("Result : \n", result, '.');
              LOG("Expected : \n", question.answer, '.');
              result = result.trim();
              if (result == question.answer) {
                student.score += config.pointsPerQuestion;
                LOG("Updated score of student is " + student.score.toString());
              } else if (config.negativeMarking) {
                negative = true;
              } else {
                LOG(
                  "Eval complete for code , no change in marks of student : " +
                  student.username +
                  " " +
                  student.score
                );
              }
            }
          },
          error => {
            LOG("Error occured during processing -- HANDLE ADMIN , ", i);
          }
        );
      } else if (question.lang == "java") {
        // handle java code
        let executionPromise = code_handling.execCode(
          answers[i],
          question.lang,
          student.username,
          i,
          question.inputFile
        );
        LOG("Waiting for execution promise");
        executionPromise.then(
          result => {
            if (result == false) LOG("The execution generated error ! ", id);
            else {
              LOG("Execution complete : ");
              LOG("Result : \n", result);
              LOG("Expected : \n", question.answer);
              if (result == question.answer) {
                student.score += config.pointsPerQuestion;
                LOG("Updated score of student is " + student.score.toString());
              } else if (config.negativeMarking) {
                negative = true;
              } else {
                LOG(
                  "Eval complete for code , no change in marks of student : " +
                  student.username +
                  " " +
                  student.score
                );
              }
            }
          },
          error => {
            LOG("Error occured during processing -- HANDLE ADMIN , ", i);
          }
        );
      }
    } else {
      if (answers[i] === mappedQB.get(i).answer)
        student.score += config.pointsPerQuestion;
      else if (config.negativeMarking) negative = true;
    }
    if (negative) student.score -= config.pointsPerQuestion;
  }
}

module.exports = {
  eval
};