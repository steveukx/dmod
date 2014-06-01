
(function () {

    'use strict';

    module.exports = InstanceBuilder;

    function InstanceBuilder () {
        this.__changed = [];
        this.__values = {};
    }


    // TODO: non-enumerable for values and changed
    InstanceBuilder.fromColumnsStore = function (columnStore) {
        var fieldsProto = {};

        columnStore.forEach(function (column) {
            Object.defineProperty(fieldsProto, column.key, {
                get: function () {
                    return this.__values[column.key];
                },
                set: function (value) {
                    if (this.__values[column.key] !== value) {
                        this.__values[column.key] = value;
                        this.__changed.indexOf(column.key) < 0 && this.__changed.push(column.key);
                    }
                }
            });
        });

        return function (values) {
            var instance = new InstanceBuilder();
            instance.__proto__ = Object.create(fieldsProto);
            if (values) {
                for (var key in values) {
                    if (fieldsProto.hasOwnProperty(key)) {
                        instance.__values[key] = values[key];
                    }
                }
            }
            return instance;
        };
    };

}());
