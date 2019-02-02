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
    errorRedirect
}