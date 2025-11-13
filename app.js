const express = require('express');
const { json } = require('body-parser');
const fileUpload = require('express-fileupload');
const jsonfile = require('jsonfile');   
const mysql = require('mysql');
const session = require('express-session');
const bcrypt = require('bcrypt');
const app = express();
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});
app.use(fileUpload());
var connection = mysql.createConnection({
    host: '192.168.4.1',
    user: 'sqlaboudaud',
    password: 'savary85*',
    database: 'aboudaud_miniblog',
    ssl: {
        rejectUnauthorized: false
    }
});

connection.connect((err) => {
    if (err) throw err;
    console.log('Connection OK !');
});

app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.listen(10009, () => {
 console.log('Serveur lancé sur http://www2.sio-savary.fr:10009');
});

app.use(session({
  secret: 'Code-secret-milicieux-hihihihihihihihihihihihihihihihihi',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 300000 }, 
  activeDuration: 5*60*1000,
  name: "LeCookieAuKakaKikouKiPu",
  ephemeral: true,
}));

function requireLogin(req, res, next) {
 if (!req.session.user) {
 res.render('login', {page: "login", user: null, error: null});
 } else {
 next();
 }
};

app.get('/', requireLogin, (req, res) => {
    const selectedCategorie = req.query.categorie;
    let sql = `
        SELECT article.*, categorie.libelle AS categorie
        FROM article
        INNER JOIN article_categorie ON article.id = article_categorie.id_article
        INNER JOIN categorie ON article_categorie.id_categorie = categorie.id
    `;
    let params = [];
    if (selectedCategorie) {
        sql += ' WHERE categorie.libelle = ?';
        params.push(selectedCategorie);
    }
    connection.query(sql, params, (err, articles) => {
        if (err) throw err;
        connection.query('SELECT * FROM categorie', (err, categories) => {
            if (err) throw err;
            res.render('index', { articles, categories, categorie: selectedCategorie, user: req.session.user });
        });
    });
});

app.get('/login', (req, res) => {
    res.render('login', { page: "login", user: null, error: null });
});

app.get('/creerCompte', (req, res) => {
    res.render('creerCompte', { page: "creerCompte", user: null });
});

app.get('/new', requireLogin, (req, res) => {
    connection.query('SELECT * FROM categorie', (err, categories) => {
        if (err) throw err;
        res.render('new', { categories, user: req.session.user });
    });
});

app.post('/new', requireLogin, (req, res) => {
    const { title, content, category } = req.body;
    const imageBuffer = req.files?.image?.data || null;
    connection.query(
        'INSERT INTO article (title, content, image) VALUES (?, ?, ?)',
        [title, content, imageBuffer],
        (err, result) => {
            if (err) throw err;
            const articleId = result.insertId;
            connection.query(
                'INSERT INTO article_categorie (id_article, id_categorie) VALUES (?, ?)',
                [articleId, category],
                (err2) => {
                    if (err2) throw err2;
                    res.redirect('/');
                }
            );
        }
    );
});

app.get('/article/:id', requireLogin, (req, res) => {
    const articleID = req.params.id;
    connection.query(
        `SELECT article.*, categorie.libelle AS categorie
         FROM article
         INNER JOIN article_categorie ON article.id = article_categorie.id_article
         INNER JOIN categorie ON article_categorie.id_categorie = categorie.id
         WHERE article.id = ?`,
        [articleID],
        (err, articles) => {
            if (err) throw err;
            if (articles.length > 0) {
                const article = articles[0];
                connection.query(
                    'SELECT * FROM commentaire WHERE idArticle = ?',
                    [articleID],
                    (err, comments) => {
                        if (err) throw err;
                        res.render('article', { article, articleID, comments, user: req.session.user });
                    }
                );
            } else {
                res.redirect('/');
            }
        }
    );
});

app.get('/article/:id/image', (req, res) => {
    const articleID = req.params.id;
    connection.query('SELECT image FROM article WHERE id = ?', [articleID], (err, results) => {
        if (err) return res.status(500).send('Erreur serveur');
        if (!results || results.length === 0 || !results[0].image) return res.status(404).send('Aucune image');
        const img = results[0].image;
        let mime = 'image/jpeg';
        if (img[0] === 0x89) mime = 'image/png';
        else if (img[0] === 0x47) mime = 'image/gif';
        else if (img[0] === 0x52) mime = 'image/webp';
        res.set('Content-Type', mime);
        res.send(img);
    });
});

app.post('/article/:id/comment', requireLogin, (req, res) => {
    const articleID = req.params.id;
    const { pseudo, text } = req.body;
        connection.query('INSERT INTO commentaire (pseudo, texte, idArticle) VALUES (?, ?, ?)', [pseudo, text, articleID], (err, result) => {
        if (err) throw err;
        res.redirect(`/article/${articleID}`);
    });
});

app.post('/article/:id/delete', requireLogin, (req, res) => {
    const articleID = req.params.id;
    connection.query('DELETE FROM commentaire WHERE idArticle = ?', [articleID], (err, result) => {
        if (err) throw err;
        connection.query('DELETE FROM article_categorie WHERE id_article = ?', [articleID], (err, result) => {
            if (err) throw err;
            connection.query('DELETE FROM article WHERE id = ?', [articleID], (err2, result2) => {
                if (err2) throw err2;
                res.redirect('/');
            });
        });
    });
});

app.post('/creationCompte', (req, res) => {
    connection.query('SELECT * FROM utilisateur WHERE login = ?', [req.body.username], (err, results) => {
        if (err) throw err;
        if (results.length > 0) {
            return res.render('creerCompte', { page: "creerCompte", user: null, error: "Ce nom d'utilisateur existe déjà" });
        }
        const { username, password } = req.body;
        bcrypt.hash(password, 10, (err, hash) => {
            if (err) throw err;
            connection.query(
                'INSERT INTO utilisateur (login, passwd) VALUES (?, ?)',
                [username, hash],
                (err, result) => {
                    if (err) throw err;
                    res.redirect('/login');
                }
            );
        });
    });
});

app.post('/logination', (req, res) => {
    const { username, password } = req.body;
    connection.query(
        'SELECT * FROM utilisateur WHERE login = ?',
        [username],
        (err, results) => {
            if (err) throw err;
            if (results.length > 0) {
                const user = results[0];
                bcrypt.compare(password, user.passwd, (err, isMatch) => {
                    if (err) throw err;
                    if (isMatch) {
                        req.session.user = user;
                        res.redirect('/');
                    } else {
                        res.render('login', {
                            page: "login",
                            error: "Nom d'utilisateur ou mot de passe incorrect",
                            user: null
                        });
                    }
                });
            } else {
                res.render('login', {
                    page: "login",
                    error: "Nom d'utilisateur ou mot de passe incorrect",
                    user: null
                });
            }
        }
    );
});

app.get('/logoutation', (req, res) => {
    req.session.reset();
    res.redirect('/');
});

app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Erreur lors de la déconnexion:', err);
        }
        res.redirect('/login');
    });
});

app.get('/api/list', (req, res) => {
    connection.query('SELECT * FROM article', (err, articles) => {
        if (err) {
            throw err;
        }
        res.json(articles); 
    });
});

app.post('/api/new', (req, res) => {
    const { title, content, category } = req.body;
    const imageBuffer = req.files?.image?.data || null;
    connection.query(
        'INSERT INTO article (title, content, image) VALUES (?, ?, ?)',
        [title, content, imageBuffer],
        (err, result) => {
            if (err) return res.status(500).json({ success: false, error: err.message });
            const articleId = result.insertId;
            connection.query(
                'INSERT INTO article_categorie (id_article, id_categorie) VALUES (?, ?)',
                [articleId, category],
                (err2) => {
                    if (err2) return res.status(500).json({ success: false, error: err2.message });
                    res.json({ success: true, articleId });
                }
            );
        }
    );
});