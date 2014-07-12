
var DMod = require('../../../src/index');

var models = new DMod(new DMod.adapters.SQLite());

models.register(
    DMod.Table('User').autoIncrementField('id')
        .uniqueField('username')
        .field('name'),

    DMod.Table('Task').autoIncrementField('id')
        .field('name')
        .dateTimeField('completed')
        .dateTimeField('created')
        .dateTimeField('due')
        .hasOne('User')
        .uniqueConstraint('name', 'user')
);

models.on('ready', function () {

    var createTaskFor = function (user) {
        var task = models.createTask({
            user: user,
            name: "my first task"
        });

        task.save(function () {
            console.log('Saved Task: ', JSON.stringify(task));
        });


        models.findUserById(1).then(function (user) {
            console.log('Found User: ', JSON.stringify(user));
        })
    };

    var user = models.createUser({
        username: 'steveukx',
        name: 'Steve King'
    });
    user.save(createTaskFor);

});
