const fs = require('fs'),
    config = require('../config.json'),
    path = require("path");
var LOG = config.debug ? console.log.bind(console) : function () {};

function fetchQuestions() {
    try {
        var questions = fs.readFileSync(path.resolve(__dirname + "/../data/quiz.json"));
        return JSON.parse(questions);
    } catch (e) {
        return null;
    }
}

function saveQuestions(data) {
    LOG('writing to file');
    fs.writeFileSync(path.resolve(__dirname + "/../data/quiz.json"), JSON.stringify(data));
}

function fetchCFG() {
    try {
        var cfg = fs.readFileSync(path.resolve(__dirname + "/../config.json"));
        return JSON.parse(cfg);
    } catch (e) {
        return null;
    }
}

function saveCFG(data) {
    console.log('writing to config.json');
    fs.writeFileSync(path.resolve(__dirname + "/../config.json"), data);
}

function addQuestions(data) {

    var existing = fetchQuestions();

    var len = existing.questions.length;
    ++len;
    data["id"] = len;

    existing.questions.push(data);

    if (data.type == 'match') {
        var array = data.answer.split(',');
        data.answer = array;
    }

    saveQuestions(existing);

}

LOG(fetchQuestions());

module.exports = {
    addQuestions,
    fetchQuestions,
    fetchCFG,
    saveCFG,
    saveQuestions

}