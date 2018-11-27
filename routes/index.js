var express = require('express');
var router = express.Router();

var expressValidator = require('express-validator');
var passport = require('passport');

var bcrypt = require('bcrypt');
const saltRounds = 10;

var url = require('url');
var request = require('request');

var multer = require('multer');

// Set Storage Engine
const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: function (req, file, cb) {
        var extArray = file.mimetype.split("/");
        var extension = extArray[extArray.length - 1];
        cb(null, file.fieldname + '-' + Date.now() + '.' + extension)
    }
});

// init upload
const upload = multer({
    storage: storage
}).single('userPhoto');


/* GET home page. */
router.get('/', function (req, res) {
    console.log(req.user);
    console.log(req.isAuthenticated())
    res.render('home', {
        title: 'Home'
    });
})

router.get('/profile', authenticationMiddleware(), function (req, res) {

    const db = require('../db.js');
    var userloged = req.user.user_id;

    db.query('SELECT username,email,User_Profile_Photo FROM users WHERE id = ?', [userloged], function (error, results, fields) {
        if (error) throw error;

        res.render('profile', {
            title: 'Profile',
            showusername: JSON.stringify(results[0].username).replace(/\"/g, ""),
            showemail: JSON.stringify(results[0].email).replace(/\"/g, ""),
            userpicture: '/uploads/' + JSON.stringify(results[0].User_Profile_Photo).replace(/\"/g, ""),
        });

    });
});

router.post('/profile', function (req, res, next) {

    upload(req, res, (err) => {
        if (err) {
            res.render('profile', {
                msg: err
            });
        } else {
            var userloged = req.user.user_id;
            var newfilename = req.file.filename;
            console.log(req.file);
            const db = require('../db.js');

            db.query('UPDATE users SET User_Profile_Photo = ? WHERE id = ?', [newfilename, userloged], function (error, results, fields) {
                if (error) throw error;

                res.render('Profile', {
                    title: 'Picture updated Sucessfully',
                    userpicture: '/uploads/' + newfilename,
                });

            })
        }
    });

});

router.get('/login', function (req, res) {
    res.render('login', {
        title: 'Login'
    });
});

router.post('/login', passport.authenticate('local', {
    successRedirect: '/profile',
    failureRedirect: '/login'
}));

router.get('/logout', function (req, res) {
    req.logout();
    req.session.destroy();
    res.redirect('/');
});

router.get('/register', function (req, res, next) {
    res.render('register', {
        title: 'Registration'
    });
});

router.post('/register', function (req, res, next) {
    req.checkBody('username', 'Username field cannot be empty.').notEmpty();
    req.checkBody('username', 'Username must be between 4-15 characters long.').len(4, 15);
    req.checkBody('email', 'The email you entered is invalid, please try again.').isEmail();
    req.checkBody('email', 'Email address must be between 4-100 characters long, please try again.').len(4, 100);
    req.checkBody('password', 'Password must be between 8-100 characters long.').len(8, 100);
    req.checkBody("password", "Password must include one lowercase character, one uppercase character, a number, and a special character.").matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?!.* )(?=.*[^a-zA-Z0-9]).{8,}$/, "i");
    req.checkBody('passwordmatch', 'Password must be between 8-100 characters long.').len(8, 100);
    req.checkBody('passwordmatch', 'Passwords do not match, please try again.').equals(req.body.password);

    // Additional validation to ensure username is alphanumeric with underscores and dashes
    req.checkBody('username', 'Username can only contain letters, numbers, or underscores.').matches(/^[A-Za-z0-9_-]+$/, 'i');

    const errors = req.validationErrors();

    if (errors) {
        console.log(`errors: ${JSON.stringify(errors)}`);

        res.render('register', {
            title: 'Registration Error',
            errors: errors
        });
    } else {
        const username = req.body.username;
        const email = req.body.email;
        const password = req.body.password;

        const db = require('../db.js');

        bcrypt.hash(password, saltRounds, function (err, hash) {
            db.query('INSERT INTO users (username, email, password) VALUES (?, ? , ?)', [username, email, hash], function (error, results, fields) {
                if (error) throw error;

                db.query('SELECT LAST_INSERT_ID() as user_id', function (error, results, fields) {
                    if (error) throw error;

                    const user_id = results[0];

                    console.log(results[0]);
                    req.login(user_id, function (err) {
                        res.redirect('/');
                    })
                });

            })
        });
    }
});


router.get('/Creategroup', function (req, res, next) {
    res.render('Creategroup', {
        title: 'Create Group'
    });
});

router.post('/Creategroup', function (req, res, next) {

    const GroupName = req.body.GroupName;
    const GroupActivity = req.body.GroupActivity;
    const GroupPhoto = req.body.GroupPhoto;
    const GroupCreator = (req.user.user_id);
    const GroupMembers = '[ ' + GroupCreator + ']';

    const db = require('../db.js');

    db.query('INSERT INTO groups (Group_name, Group_Activity, Group_Photo, Group_creator, Group_members) VALUES (?, ? , ?, ?, ?)', [GroupName, GroupActivity, GroupPhoto, GroupCreator, GroupMembers], function (error, results, fields) {
        if (error) throw error;

        res.render('Creategroup', {
            title: 'Group Created Sucessfully',
        });

    })
});

router.get('/mygroups', function (req, res, next) {

    const db = require('../db.js');

    let grouplist = [];
    var groupcards = '';
    var imgreturned = '';

    var dbgroupreturn = new Promise(function (resolve, reject) {
        db.query('SELECT id, Group_name, Group_Activity, Group_Photo, Group_Creator, Group_members FROM groups ', function (error, results, fields) {
            if (error) throw error;

            const UserID = (req.user.user_id);

            for (var i = 0; i < results.length; i++) {
                var memberlist = results[i].Group_members;

                for (var j = 0; j < memberlist.length; j++) {
                    if (memberlist[j] == UserID) {
                        grouplist.push(results[i]);

                    }

                }
            }

            resolve(grouplist);
        })
    }).then(function (grouplist) {
        for (var k = 0; k < grouplist.length; k++) {
            var groupname = "<a href='group?" + grouplist[k].id + "'><div class='groupcarddiv'><h3>" + grouplist[k].Group_name + "</h3>";
            var groupActivity = "<p>" + grouplist[k].Group_Activity + "</p>";
            var groupPhoto = "<p>" + grouplist[k].Group_Photo + "</p>";
            var groupCreator = "<p>" + grouplist[k].Group_Creator + "</p>";

            var groupmemberlist = JSON.parse(grouplist[k].Group_members);

            async function findpicture(id) {
                return new Promise(function (resolve, reject) {
                    db.query('SELECT User_Profile_Photo FROM users WHERE id = ?', [id], function (error, results, fields) {
                        if (error) {
                            throw error;
                        } else {
                            imgname = results[0].User_Profile_Photo;
                            resolve(imgname);
                        }
                    });
                });
                return imgreturned
            };

            for (var m = 0; m < groupmemberlist.length; m++) {
                var imgtag = findpicture(groupmemberlist[m]);
                var imgtagresolved = imgtag.then(function (imgname) {

                    var imgreturned = '<img href="/uploads/' + imgname + ">";
                    return imgreturned;

                })
                console.log(imgtagresolved);
                // intention is to define groupMembers = as a div with the img tags inside, I am letting the console.log above to show results I am getting before be sure I can use the promise value into this var
            }



            var groupMembers = "<p>" + grouplist[k] + "</p></div></a>";
            groupcards += groupname + groupActivity + groupPhoto + groupCreator + groupMembers;
        }

        res.render('mygroups', {
            title: 'Groups',
            showgroups: groupcards,
        });
    })


    /*   var groupcards = '';
       for (var k = 0; k < grouplist.length; k++) {

           var groupname = "<a href='group?" + grouplist[k].id + "'><div class='groupcarddiv'><h3>" + grouplist[k].Group_name + "</h3>";
           var groupActivity = "<p>" + grouplist[k].Group_Activity + "</p>";
           var groupPhoto = "<p>" + grouplist[k].Group_Photo + "</p>";
           var groupCreator = "<p>" + grouplist[k].Group_Creator + "</p>";

           var groupmemberlist = JSON.parse(grouplist[k].Group_members);

           let imgFromId;
           let imgtag;

           function returnimage(imgid) {
               imgtag = '<img href="/uploads/' + imgid[0].User_Profile_Photo + ">";

           }

           function findpicture(id, callback) {



               return new Promise(function (resolve, reject) {
                   var dbconnectionforpicture = db.query('SELECT User_Profile_Photo FROM users WHERE id = ?', [id], function (error, results, fields) {
                       if (error) {
                           throw error;
                       } else {
                           imgFromId = results;
                       }
                       callback(imgFromId);
                   });
                   request.get(dbconnectionforpicture, function (err, resp, body) {
                       if (err) {
                           reject(err);
                       } else {
                           resolve(console.log(imgtag));
                       }
                   })
               })
           };

           for (var m = 0; m < groupmemberlist.length; m++) {
               var imgreturned = findpicture(groupmemberlist[m], returnimage);

           }



           var groupMembers = "<p>" + grouplist[k] + "</p></div></a>";

           groupcards += groupname + groupActivity + groupPhoto + groupCreator + groupMembers;
       };*/



})


router.route('/group').get(function (req, res, next) {
    var q = url.parse(req.url, true);
    var urlgroup = q.search.slice(1);

    console.log(urlgroup);

    const db = require('../db.js');

    db.query('SELECT id,Group_Name FROM groups WHERE id = ?', [urlgroup], function (error, results, fields) {
        if (error) throw error;

        console.log(results);

        res.render('group', {
            title: 'Group',
            groupname: JSON.stringify(results[0].id).replace(/\"/g, ""),
            groupactivity: JSON.stringify(results[0].Group_Name).replace(/\"/g, ""),
        });

    });
});


passport.serializeUser(function (user_id, done) {
    done(null, user_id);
});

passport.deserializeUser(function (user_id, done) {
    done(null, user_id);
});

function authenticationMiddleware() {
    return (req, res, next) => {
        console.log(`req.session.passport.user: ${JSON.stringify(req.session.passport)}`);

        if (req.isAuthenticated()) return next();
        res.redirect('/login')
    }
}

module.exports = router;