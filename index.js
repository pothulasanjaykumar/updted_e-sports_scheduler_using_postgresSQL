const express = require('express');
const csrf = require('csurf');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const { User, games, Students, Register } = require('./models'); 
const bcrypt = require('bcrypt');
const saltRounds = 10;
const passport = require('passport');
const session = require('express-session');
const LocalStrategy = require('passport-local').Strategy;
const moment = require('moment'); 
const config = require('./config/config.json');



const app = express();
const cookieParser = require('cookie-parser');

app.use(cookieParser('shh! some secret string'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.use(express.static(__dirname + '/public'));

const flash = require('express-flash');

app.use(flash());


const csrfProtection = csrf({ cookie: true });
app.use(csrfProtection);

app.use(
    session({
        secret: 'my-super-secret-key-21728172615261562',
        cookie: {
            maxAge: 24 * 60 * 60 * 1000, // 24hrs
        },
    })
);

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy({ usernameField: 'email', passwordField: 'password' },
    async (username, password, done) => {
        try {
            const user = await User.findOne({ where: { email: username } });
            if (!user) {
                return done(null, false);
            }
            const result = await bcrypt.compare(password, user.password);
            if (result) {
                return done(null, user);
            } else {
                return done(null, false, { message: 'Invalid Password' });
            }
        } catch (error) {
            return done(error);
        }
    }
));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findByPk(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    res.render('signup', { title: 'signup', csrfToken: req.csrfToken() });
});

async function createUser(username, email, password, confirmPassword) {
    const existingUser = await User.findOne({ where: { email } });

    if (existingUser) {
        throw new Error('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    return User.create({
        username,
        email,
        password: hashedPassword,
        confirmPassword,
    });
}


app.post('/users', async (req, res) => {
    try {
        await createUser(
            req.body.username,
            req.body.email,
            req.body.password,
            req.body.confirmPassword
        );

        req.flash('success', 'Account created successfully! Please log in.');
        res.redirect('/login');
    } catch (error) {
        console.error(error);
        req.flash('error', error.message || 'Invalid request');
        res.redirect('/'); // Redirect back to signup page
    }
});


app.post('/games', async (req, res) => {
    try {
        // Parse and format the date using moment.js
        const formattedDate = moment(req.body.date).format('YYYY-MM-DD');

        const game = await games.create({
            title: req.body.title,
            subtitle: req.body.subtitle,
            date: formattedDate, // Use the formatted date
            userId: req.user.id,
        });

        res.redirect('/games');
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/games', async (request, response) => {
    try {
        const allgames = await games.getgames();

        if (request.accepts('html')) {
            response.render('index', {
                allgames,
                today: new Date().toLocaleDateString(),
                csrfToken: request.csrfToken(),
            });
        } else {
            response.json(allgames);
        }
    } catch (error) {
        console.error(error);
        response.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/login', (req, res) => {
    res.render('login', { title: "Login", csrfToken: req.csrfToken() });
});

app.post('/session', passport.authenticate('local', { failureRedirect: "/login" }), (req, res) => {
    res.redirect('/games');
});

app.get('/signout', (req, res, next) => {
    req.logout((error) => {
        if (error) { return next(error) };
        res.redirect('/')
    })
});

app.delete('/games/:id', csrfProtection, async (request, response) => {
    const gameId = request.params.id;

    try {
        await games.deleteGameById(gameId);
        response.sendStatus(200);
    } catch (error) {
        console.error(error);
        response.status(500).json({ error: 'Internal Server Error' });
    }
});

// Students signup login routes

app.get('/students', (req, res) => {
    res.render('student_signup', { title: 'students_signup', csrfToken: req.csrfToken() });
});

async function createStudents(studentname, email, password, confirmPassword) {
    const existingStudent = await Students.findOne({ where: { email } });

    if (existingStudent) {
        throw new Error('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    return Students.create({
        studentname,
        email,
        password: hashedPassword,
        confirmPassword,
    });
}


app.post('/students_signup', async (req, res) => {
    try {
        await createStudents(
            req.body.studentname,
            req.body.email,
            req.body.password,
            req.body.confirmPassword
        );

        res.redirect('/students_login'); // Redirect to students_login page
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: error.message || 'Invalid request' });
    }
});

app.get('/students_login', (req, res) => {
    res.render('students_login', { title: "students_login", csrfToken: req.csrfToken() });
});

app.post('/students_login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const student = await Students.findOne({ where: { email } });
        if (!student) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        const passwordMatch = await bcrypt.compare(password, student.password);
        if (!passwordMatch) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        // Set up session for the authenticated student
        req.session.studentId = student.id;

        // Redirect to the dashboard upon successful login
        res.redirect('/students_dashboard');
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


app.get('/students_dashboard', async (req, res) => {
    try {
        const allgames = await games.getgames();
        res.render('header', { title: "Students Dashboard", allgames, csrfToken: req.csrfToken() });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});



app.get("/register", (req, res) => {
    res.render('register.ejs', { csrfToken: req.csrfToken() });
});


app.post('/register',(req,res)=>{
    res.render('register.ejs', { csrfToken: req.csrfToken() })
});


app.post('/studentRegister', async (req, res) => {
    try {
        const { registername, registercollege, branch } = req.body;

        if (!registername || !registercollege || !branch) {
            throw new Error('All fields are required');
        }

        const newStudent = await Register.create({
            studentname: registername,
            college: registercollege,
            branch: branch,

        });

        req.flash('success', 'Successfully registered!');

        res.redirect('/register');
    } catch (error) {
        console.error(error);
        req.flash('error', error.message || 'An error occurred during registration');
        res.redirect('/register');
    }
});







app.listen(3000, () => {
    console.log('Express server started at port 3000');
});









