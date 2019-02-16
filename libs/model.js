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
    constructor(username) {
        this.username = username;
        this.name = undefined;
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