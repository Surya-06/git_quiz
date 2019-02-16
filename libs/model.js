class questionResponse {
    constructor(question, answer, code = undefined) {
        this.question = question;
        this.answer = answer;
        this.code = code;
    }
    addCode(code) {
        this.code = code
    }
};
class student {
    constructor(username,name) {
        this.username = username;
        this.name = name;
        this.login = true;
        this.testStartTime = undefined;
        this.testEndTime = undefined;
        this.score = undefined;
        this.submitted = false;
        this.answers = [];
    }
};

module.exports = {
    student: student,
    questionResponse: questionResponse
}