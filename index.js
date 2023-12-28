const express = require('express');
const path = require('path');
const pmx = require('pmx').init(); // Initialize PMX
const pm2 = require('pm2');
const chalk = require('chalk');

const app = express();


// Variable to store the IP whitelist, initialized as null
let ipWhitelist = null;

// Fetch configuration using PM2 Keymetrics
pmx.initModule({}, (err, conf) => {
    if (conf.IP_WHITELIST) {
        console.log  ("Configuration :");
        console.table (conf);
        ipWhitelist = conf.IP_WHITELIST.split(',');
    } else {
        console.warn(chalk.yellow('Warning: IP whitelist not configured. \n\r Set the whitelist using `pm2 set pm2-webui:IP_WHITELIST "127.0.0.1,192.168.1.1"`'));
    }
});

// Custom logging middleware
app.use((req, res, next) => {
    // Capture the start time
    const startTime = process.hrtime();

    // Function to log details
    const logDetails = () => {
        const diff = process.hrtime(startTime);
        const responseTime = diff[0] * 1e3 + diff[1] * 1e-6; // Convert to milliseconds

        console.log(`Path: ${req.path} | IP: ${req.ip} | X-Forwarded-For: ${req.headers['x-forwarded-for'] || 'N/A'} | Status: ${res.statusCode} | Response Time: ${responseTime.toFixed(3)} ms`);
    };

    // Hook into the finish event of the response
    res.on('finish', logDetails);

    // Proceed to the next middleware
    next();
});




// Middleware for IP Whitelisting
app.use((req, res, next) => {
    if (!ipWhitelist) {
        return next(); // Allow all IPs if whitelist not configured
    }

    const clientIp = req.ip || req.connection.remoteAddress;
    if (ipWhitelist.includes(clientIp)) {
        next();
    } else {
        res.status(403).send('Access Denied');
    }
});


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
                const processList = list.filter(proc => (proc.name !== path.basename(__filename, '.js')) && 
							(proc.name !== "pm2-webui"  )  );
                res.render('list', { processList });
            }
        });
    });
});

app.listen(3333, function() {
    console.log('App is listening on port 3333');
});
