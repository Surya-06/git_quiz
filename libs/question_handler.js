const io = require("./QuizIO"),
    config = require("../config.json"),
    code_handling = require('./code_handling.js');
var LOG = config.debug ? console.log.bind(console) : function () {};

function getQuestions(count, questionBank) {
    let indices = new Set(),
        questions = [];
    while (indices.size !== count)
        indices.add(Math.floor(Math.random() * questionBank.length))
    let array_indices = Array.from(indices);
    for (let i = 0; i < count; i++)
        questions.push(questionBank[array_indices[i]]);
    return questions;
}

function updateQuestions(COUNT, questionBank, mappedQB) {
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
        return {
            questionsExist: questionsExist,
            questionBank: questionBank,
            mappedQB: mappedQB,
            count: COUNT
        };
    } else {
        // questions not yet set 
        questionsExist = false;
        return {
            questionsExist: questionsExist,
            questionBank: undefined,
            mappedQB: undefined,
            count: COUNT
        };
    }
}

module.exports = {
    getQuestions,
    updateQuestions
}