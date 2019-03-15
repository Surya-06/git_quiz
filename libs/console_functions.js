const config = require("../config.json"),
  code_handling = require('./code_handling.js'),
  xlsx = require('xlsx'),
  path = require('path'),
  PdfPrinter = require('pdfmake'),
  readline = require('readline'),
  fs = require('fs'),
  fse = require('fs-extra');

var LOG = config.debug ? console.log.bind(console) : function () {};

var FILE_PATH = 'Results/';

const PDF_EXTENSION = '.pdf',
  FONTS = {
    Roboto: {
      normal: "fonts/Roboto-Regular.ttf",
      bold: "fonts/Roboto-Medium.ttf",
      italics: "fonts/Roboto-Italic.ttf",
      bolditalics: "fonts/Roboto-MediumItalic.ttf"
    }
  };;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function show_scores(studentMap) {
  console.log("Showing results");
  console.log("------------------------------------\n");
  var entries = studentMap.entries();
  for (var val of entries) {
    console.log("Student : " + val[0] + " || Score : " + val[1].score);
  }
  console.log("\n------------------------------------\n");
  return;
}

function help() {
  console.log("------------------------------------\n");
  console.log(
    `
          results ------ 'Display results'
          help ------ 'Display help'
          `
  );
  console.log("\n------------------------------------\n");
  return;
}

function activateConsoleFunctions(studentMap) {
  // Handle admin input to server
  var stdin = process.openStdin();

  stdin.addListener("data", function (command) {
    // convert to usable state
    command = command.toString().trim();
    if (command == "results") {
      show_scores(studentMap);
    } else if (command == "help") {
      help();
    }
    process.stdout.write(`COMMAND(Type 'help' for help) : `);
  });
}

function writeToExcel(data, questionCount) {
  LOG('Starting to write data');
  let final_data = [];
  let headers = ['Username', 'Test Start Time', 'Test End Time', 'Score', 'Remarks'];
  for (let i = 1; i <= questionCount; i++) {
    headers.push('Question ' + i);
    headers.push('Answer ' + i);
  }
  final_data.push(headers);
  for (var keys of data.keys()) {
    var user_data = [];
    user_data.push(data.get(keys).username);
    user_data.push(new Date(data.get(keys).testStartTime));
    user_data.push(new Date(data.get(keys).testEndTime));
    user_data.push(data.get(keys).score);
    user_data.push(data.get(keys).flag);
    let answers = data.get(keys).answers;
    for (let i in answers) {
      let question_value = answers[i].question;
      if (answers[i].code) question_value = question_value + '\n' + answers[i].code;
      user_data.push(JSON.stringify(question_value));
      user_data.push(JSON.stringify(answers[i].Studentanswer));
    }
    final_data.push(user_data);
    LOG('Pushing user data : ', user_data);
  }
  let ws_name = "Results",
    wb = xlsx.utils.book_new(),
    ws = xlsx.utils.aoa_to_sheet(final_data);
  xlsx.utils.book_append_sheet(wb, ws, ws_name);
  let filePath = '/data/Results.xlsx';
  xlsx.writeFile(wb, path.resolve(__dirname + '/..' + filePath));
  LOG('Completed writing to file');
  return filePath;
}


//Returns map of (id,name) from Excel file
function getNamesFromExcel() {
  let filePath = path.resolve(__dirname + '/../data/Names.xlsx');
  var wb = xlsx.readFile(filePath);
  var firstSheet = wb.SheetNames[0];
  var ws = wb.Sheets[firstSheet];
  var d = xlsx.utils.sheet_to_json(ws); //Array of objects

  var namesMap = new Map();

  d.forEach((row) => {
    var id = row.ID.toString();
    var Name = row.Names;
    namesMap.set(id, Name);
  });
  return namesMap;
}

function insertData(tag, value, content, size = 15) {
  content.push({
    text: [{
      text: tag,
      fontSize: size
    }, value]
  });
  // return content;
}

function modPDFPath(path) {
  FILE_PATH = FILE_PATH + path + '/';
  return;
}

function generatePDF(studentData) {
  var filePath = FILE_PATH + studentData.username + PDF_EXTENSION;
  fse.ensureFileSync(filePath);

  LOG("Generating pdf file at : ", filePath);

  var printer = new PdfPrinter(FONTS);
  var docDefinition = {
    content: []
  };

  let distance = new Date(studentData.testEndTime).getTime() - new Date(studentData.testStartTime).getTime(),
    minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
    seconds = Math.floor((distance % (1000 * 60)) / 1000),
    duration = minutes + "min " + seconds + "sec ";

  insertData("TEST SUMMARY FOR : ", studentData.name, docDefinition.content, 20);
  insertData("Username : ", studentData.username, docDefinition.content);
  insertData("Name : ", studentData.name, docDefinition.content);
  insertData("Test Start Time : ", studentData.testStartTime, docDefinition.content);
  insertData("Test End Time : ", studentData.testEndTime, docDefinition.content);
  insertData("Test Duration : ", duration, docDefinition.content);
  insertData("Score : ", studentData.score, docDefinition.content);
  insertData("Remark : ", studentData.flag, docDefinition.content);
  insertData("\n", "", docDefinition.content);
  let answers = studentData.answers.slice();
  for (let i = 0; i < answers.length; i++) {
    insertData("Question " + (i + 1) + ": ", "", docDefinition.content);
    insertData("", answers[i].question, docDefinition.content);
    if (answers[i].code)
      insertData("", answers[i].code, docDefinition.content);
    insertData("Student answer : ", "", docDefinition.content);
    insertData("", JSON.stringify(answers[i].Studentanswer), docDefinition.content);
    insertData("Solution : ", "", docDefinition.content);
    insertData("", JSON.stringify(answers[i].solution), docDefinition.content);
    insertData("\n---------------------------------------------------\n", "", docDefinition.content);
  }

  LOG('Content in PDF : ', docDefinition.content);

  var pdfDoc = printer.createPdfKitDocument(docDefinition);
  pdfDoc.pipe(fs.createWriteStream(filePath));
  pdfDoc.end();

  LOG('Completed writing to document');

  return "/" + filePath;
}

function takeUserInput(questionText, readlineClose = false) {
  return new Promise(resolve => rl.question(questionText, answer => {
    resolve(answer);
    if (readlineClose)
      rl.close();
    LOG("Resolved answer returning from method");
    return;
  }))
};

module.exports = {
  activateConsoleFunctions,
  writeToExcel,
  getNamesFromExcel,
  generatePDF,
  takeUserInput,
  modPDFPath
};