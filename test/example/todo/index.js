
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
    var user = models.createUser({
        username: 'steveukx'
    });
    user.name = 'Steve King';
    user.save(function (user) {
        user.name = 'Bob';
        user.save();
    });


    var task = models.createTask({

    })
});
