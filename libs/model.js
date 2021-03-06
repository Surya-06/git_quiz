class questionResponse {
    constructor(question, type, answer, solution,code = undefined) {
        this.question = question;
        this.type = type;
        this.Studentanswer = answer;
        this.solution = solution;
        this.code = code;
    }
    addCode(code) {
        this.code = code
    }
};
class student {
    constructor(username, name) {
        this.flagValues = {
            'no_attempt': 'NO ATTEMPT',
            'reload': 'RELOAD',
            'time_out': 'TIME OUT',
            'cheat': 'CHEAT',
            'normal': 'NORMAL'
        };
        this.username = username;
        this.name = name;
        this.login = true;
        this.testAttempted = false;
        this.testDuration = undefined;
        this.testStartTime = undefined;
        this.testEndTime = undefined;
        this.score = undefined;
        this.answers = [];
        this.flag = undefined;
    }
    resetStats() {
        this.testAttempted = false;
        this.testDuration = undefined;
        this.testStartTime = undefined;
        this.testEndTime = undefined;
        this.score = undefined;
        this.answers = [];
        this.flag = undefined;
    }
};

module.exports = {
    student: student,
    questionResponse: questionResponse
}