const exec = require("child_process").exec,
    config = require("../config.json"),
    fs = require("fs"),
    fse = require("fs-extra");
var LOG = config.debug ? console.log.bind(console) : function () {};

function write_to_file(code, extension, fileName) {
    var filePath = "code/" + fileName + "." + extension;
    fse.ensureFileSync(filePath);
    fs.writeFileSync(filePath, code, err => {
        if (err) {
            return false;
        }
    });
    return filePath;
}

function execPromise(command) {
    return new Promise(function (resolve, reject) {
        exec(command, (error, stdout, stderr) => {
            LOG("\n\nReturning from call : " + command);
            if (error) {
                LOG("Rejection due to error : " + error);
                reject(error);
                return;
            }
            if (stderr) {
                LOG("Returning stderr " + stderr);
                resolve(false);
                return;
            }
            LOG("stdout trim right : \n" + stdout.trimRight());
            if (stdout.trim() == "") {
                LOG("Resolving true ");
                resolve(true);
                return;
            }
            stdout = stdout
            LOG("Resolving with stdout : \n" + stdout.trim());
            resolve(stdout.trim());
            return;
        });
    });
}

function execCode(code, lang, username, id, inputFile) {
    var fileName = username + "_" + id;
    LOG("File Name : " + fileName);
    var result = write_to_file(code, lang, fileName);
    return new Promise((resolve, reject) => {
        if (lang == "cpp") {
            var compilation =
                config.cppCompile +
                " " +
                result +
                " -o code/" +
                fileName +
                config.cppExecFile;
            var mainExecCommand = "code/" + fileName + config.cppExecFile;
            if (config.os_windows) mainExecCommand = '"' + mainExecCommand + '"';
            var execution = mainExecCommand + "< " + inputFile;
            var compilation_promise = execPromise(compilation);
            compilation_promise.then(
                result => {
                    LOG("\n\n");
                    if (result == false) {
                        LOG("Resolving false at compilation from id ", id);
                        resolve(false);
                    } else {
                        LOG("Compilation complete , proceeding to execution");
                        // proceed with execution
                        var execution_promise = execPromise(execution);
                        execution_promise.then(
                            result => {
                                LOG("Execution complete -- ");
                                if (result == false) {
                                    LOG("Resolving false at execution");
                                    resolve(false);
                                    return;
                                }
                                resolve(result);
                                return;
                            },
                            error => {
                                LOG("Error in process during execution");
                                reject(error);
                                return;
                            }
                        );
                    }
                },
                error => {
                    LOG("Error during compilation ", id);
                    reject(error);
                    return;
                }
            );
        } else if (lang == "python") {
            // execute python
            var executePython =
                config.pythonCommand + " " + result + " < " + inputFile;
            var executionPromise = execPromise(executePython);
            executionPromise.then(
                result => {
                    LOG("Execution complete");
                    if (result == false) {
                        LOG("Resolving false at execution");
                        resolve(false);
                        return;
                    }
                    resolve(result);
                    return;
                },
                error => {
                    LOG("Error in process during execution");
                    reject(error);
                    return;
                }
            );
        } else if (lang == "java") {
            // execute java
            var compilation = config.javaCompile + " " + result;
            var execution = "java -cp code/ " + fileName + "< " + inputFile;
            var compilation_promise = execPromise(compilation);
            compilation_promise.then(
                result => {
                    LOG("\n\n");
                    if (result == false) {
                        LOG("Resolving false at compilation from id ", id);
                        resolve(false);
                    } else {
                        LOG("Compilation complete , proceeding to execution");
                        // proceed with execution
                        var execution_promise = execPromise(execution);
                        execution_promise.then(
                            result => {
                                LOG("Execution complete -- ");
                                if (result == false) {
                                    LOG("Resolving false at execution");
                                    resolve(false);
                                    return;
                                }
                                resolve(result);
                                return;
                            },
                            error => {
                                LOG("Error in process during execution");
                                reject(error);
                                return;
                            }
                        );
                    }
                },
                error => {
                    LOG("Error during compilation ", id);
                    reject(error);
                    return;
                }
            );
        }
    });
}


module.exports = {
    execCode,
    execPromise,
    write_to_file
};