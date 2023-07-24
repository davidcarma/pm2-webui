const express = require('express');
const path = require('path');
const pm2 = require('pm2');

const app = express();

app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');

app.get('/manage/:processname/:action', function(req, res) {
    pm2.connect(function(err) {
        if (err) {
            console.error(err);
            res.status(500).send(err.message);
            return;
        }

        switch (req.params.action) {
            case 'start':
                pm2.start(req.params.processname, function(err) {
                    pm2.disconnect();
                    if (err) {
                        console.error(err);
                        res.status(500).send(err.message);
                    } else {
                        console.log(`Process ${req.params.processname} started`);
                        res.send(`Process ${req.params.processname} started`);
                    }
                });
                break;
            case 'stop':
                pm2.stop(req.params.processname, function(err) {
                    pm2.disconnect();
                    if (err) {
                        console.error(err);
                        res.status(500).send(err.message);
                    } else {
                        console.log(`Process ${req.params.processname} stopped`);
                        res.send(`Process ${req.params.processname} stopped`);
                    }
                });
                break;
            case 'restart':
                pm2.restart(req.params.processname, function(err) {
                    pm2.disconnect();
                    if (err) {
                        console.error(err);
                        res.status(500).send(err.message);
                    } else {
                        console.log(`Process ${req.params.processname} restarted`);
                        res.send(`Process ${req.params.processname} restarted`);
                    }
                });
                break;
            default:
                res.send('Invalid action');
                break;
        }
    });
});

app.get('/state/:processname', function(req, res) {
    pm2.connect(function(err) {
        if (err) {
            console.error(err);
            res.status(500).send(err.message);
            return;
        }

        pm2.describe(req.params.processname, function(err, processDescription) {
            pm2.disconnect();
            if (err) {
                console.error(err);
                res.status(500).send(err.message);
            } else {
                console.log(`Process ${req.params.processname} state: ${processDescription[0].pm2_env.status}`);
                res.send(processDescription[0].pm2_env.status);
            }
        });
    });
});


app.get('/states', function(req, res) {
    pm2.connect(function(err) {
        if (err) {
            console.error(err);
            res.status(500).send(err.message);
            return;
        }

        pm2.list(function(err, list) {
            pm2.disconnect();
            if (err) {
                console.error(err);
                res.status(500).send(err.message);
            } else {
                const processList = list.filter(proc => proc.name !== path.basename(__filename, '.js'));
                let statuses = processList.map(proc => ({
                    name: proc.name,
                    status: proc.pm2_env.status,
                    cpu: proc.monit.cpu,
                    memory: (proc.monit.memory / 1024 / 1024).toFixed(2),
                    restart_time: proc.pm2_env.restart_time
                }));
                res.send(statuses);
            }
        });
    });
});


app.get('/', function(req, res) {
    pm2.connect(function(err) {
        if (err) {
            console.error(err);
            res.status(500).send(err.message);
            return;
        }

        pm2.list(function(err, list) {
            pm2.disconnect();
            if (err) {
                console.error(err);
                res.status(500).send(err.message);
            } else {
                console.log('Listing processes');
                const processList = list.filter(proc => proc.name !== path.basename(__filename, '.js'));
                res.render('list', { processList });
            }
        });
    });
});

app.listen(3000, function() {
    console.log('App is listening on port 3000');
});
