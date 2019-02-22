const config = require("../config.json");
var LOG = config.debug ? console.log.bind(console) : function () {};

function checkAuthentication(req, res, next) {
    if (req.session.username && req.session.password) {
        next();
    } else {
        let err = new Error("Invalid authentication");
        next(err);
    }
    return;
}

function checkAdminAuthentication(req, res, next) {
    if (req.session.username == config.admin.username && req.session.password == config.admin.password)
        next();
    else {
        next(new Error('Invalid authentication for admin'));
    }
    return;
}

function errorRedirect(err, req, res, next) {
    LOG(err);
    res.render("error.ejs", {
        context: err,
        msg: "Please use valid authentication to access page"
    });
    return;
}

module.exports = {
    checkAuthentication,
    checkAdminAuthentication,
    errorRedirect
}