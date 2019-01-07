class student {
    constructor ( username ){
        this.username = username ;
        this.login = true ;
        this.testStartTime = undefined ;
        this.testEndTime = undefined ;
        this.score = undefined ;
    }
};

module.exports = {
    student : student 
}