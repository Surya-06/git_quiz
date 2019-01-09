const fs = require('fs'),
    config = require('./config.json');
var LOG = config.debug ? console.log.bind(console) : function () {};

function fetchQuestions() {
    try {
        var questions = fs.readFileSync('data/quiz.json');
        return JSON.parse(questions);
    } catch (e) {
        return null;
    }
}

function saveQuestions(data) {
    LOG('writing to file');
    fs.writeFileSync('data/quiz.json', JSON.stringify(data));
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
    fetchQuestions

}