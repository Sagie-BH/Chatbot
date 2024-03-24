const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const app = express();
const PORT = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public')); // Serve static files
app.set('view engine', 'ejs');

const parseNluData = (nluData) => {
    const parsedData = {};
    nluData.nlu.forEach(intentData => {
        // Split the examples by newline and trim each example
        const examples = intentData.examples.split('\n').map(example => example.trim()).filter(example => example !== '');
        parsedData[intentData.intent] = examples;
    });
    return parsedData;
};


const parseDomainData = (domainData) => {
    return {
        responses: domainData.responses,
        actions: domainData.actions,
        entities: domainData.entities
    };
};

const parseStoriesData = (storiesData) => {
    return storiesData.stories.map(story => ({
        story: story.story,
        steps: story.steps.map(step => step.intent || step.action)
    }));
};

const parseRulesData = (rulesData) => {
    if (!rulesData || !Array.isArray(rulesData.rules)) {
        return [];
    }

    return rulesData.rules.map(rule => ({
        rule: rule.rule,
        conditions: Array.isArray(rule.conditions) ? rule.conditions.map(condition => condition.intent) : [],
        actions: Array.isArray(rule.actions) ? rule.actions : []
    }));
};

app.get('/', (req, res) => {
    const categories = fs.readdirSync(path.join(__dirname, 'data')).filter(file => fs.statSync(path.join(__dirname, 'data', file)).isDirectory());
    const categoryData = {};

    categories.forEach(category => {
        const nluPath = path.join(__dirname, 'data', category, 'nlu.yml');
        const storiesPath = path.join(__dirname, 'data', category, 'stories.yml');
        const domainPath = path.join(__dirname, 'data', category, 'domain.yml');
        const rulesPath = path.join(__dirname, 'data', category, 'rules.yml');

        categoryData[category] = {
            nlu: fs.existsSync(nluPath) ? parseNluData(yaml.load(fs.readFileSync(nluPath, 'utf8'))) : {},
            stories: fs.existsSync(storiesPath) ? parseStoriesData(yaml.load(fs.readFileSync(storiesPath, 'utf8'))) : {},
            domain: fs.existsSync(domainPath) ? parseDomainData(yaml.load(fs.readFileSync(domainPath, 'utf8'))) : {},
            rules: fs.existsSync(rulesPath) ? parseRulesData(yaml.load(fs.readFileSync(rulesPath, 'utf8'))) : {}
        };
    });

    res.render('index', { categories, categoryData });
});


app.post('/save-intent', (req, res) => {
    const { category, intentName, examples, response } = req.body;
    const categoryPath = path.join(__dirname, 'data', category);

    // Ensure category directory exists
    if (!fs.existsSync(categoryPath)) {
        fs.mkdirSync(categoryPath);
    }

    // Reconstruct NLU data
    const nluPath = path.join(categoryPath, 'nlu.yml');
    let nluData = fs.existsSync(nluPath) ? yaml.load(fs.readFileSync(nluPath, 'utf8')) : { version: '3.0', nlu: [] };
    const intentIndex = nluData.nlu.findIndex(intent => intent.intent === intentName);
    if (intentIndex !== -1) {
        nluData.nlu[intentIndex].examples = examples.split('\n').map(example => `- ${example.trim()}`);
    } else {
        nluData.nlu.push({ intent: intentName, examples: examples.split('\n').map(example => `- ${example.trim()}`) });
    }
    fs.writeFileSync(nluPath, yaml.dump(nluData), 'utf8');

    // Reconstruct Domain data for responses
    const domainPath = path.join(categoryPath, 'domain.yml');
    let domainData = fs.existsSync(domainPath) ? yaml.load(fs.readFileSync(domainPath, 'utf8')) : { version: '3.0', responses: {} };
    domainData.responses[`utter_${intentName}`] = [{ text: response.trim() }];
    fs.writeFileSync(domainPath, yaml.dump(domainData), 'utf8');

    res.redirect('/');
});

app.post('/save-story', (req, res) => {
    const { category, storyName, steps } = req.body;
    const categoryPath = path.join(__dirname, 'data', category);

    // Ensure category directory exists
    if (!fs.existsSync(categoryPath)) {
        fs.mkdirSync(categoryPath);
    }

    // Reconstruct Stories data
    const storiesPath = path.join(categoryPath, 'stories.yml');
    let storiesData = fs.existsSync(storiesPath) ? yaml.load(fs.readFileSync(storiesPath, 'utf8')) : { version: '3.0', stories: [] };
    const storyIndex = storiesData.stories.findIndex(story => story.story === storyName);
    const storySteps = steps.split('\n').map(step => ({ intent: step.trim() }));
    if (storyIndex !== -1) {
        storiesData.stories[storyIndex].steps = storySteps;
    } else {
        storiesData.stories.push({ story: storyName, steps: storySteps });
    }
    fs.writeFileSync(storiesPath, yaml.dump(storiesData), 'utf8');

    res.redirect('/');
});


app.post('/save-rule', (req, res) => {
    const { category, ruleName, conditions, actions } = req.body;
    const categoryPath = path.join(__dirname, 'data', category);

    // Ensure category directory exists
    if (!fs.existsSync(categoryPath)) {
        fs.mkdirSync(categoryPath);
    }

    // Reconstruct Rules data
    const rulesPath = path.join(categoryPath, 'rules.yml');
    let rulesData = fs.existsSync(rulesPath) ? yaml.load(fs.readFileSync(rulesPath, 'utf8')) : { version: '3.0', rules: [] };
    const ruleIndex = rulesData.rules.findIndex(rule => rule.rule === ruleName);
    const ruleConditions = conditions.split('\n').map(cond => ({ intent: cond.trim() }));
    const ruleActions = actions.split('\n').map(act => act.trim());
    if (ruleIndex !== -1) {
        rulesData.rules[ruleIndex].conditions = ruleConditions;
        rulesData.rules[ruleIndex].actions = ruleActions;
    } else {
        rulesData.rules.push({ rule: ruleName, conditions: ruleConditions, actions: ruleActions });
    }
    fs.writeFileSync(rulesPath, yaml.dump(rulesData), 'utf8');

    res.redirect('/');
});


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});