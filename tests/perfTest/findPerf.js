var _ = require('underscore');
var list = [];
var N = 1000000;
for (var i=0; i< N; i++){
    list.push({
        user: 'user' + Math.random(),
        agent: 'agent' + Math.random(),
        room: 'room' + Math.random()
    });
}


var ind0 = Math.floor( Math.random() * N );

console.time('findWhere');
_.findWhere(list, list[ind0]);
console.timeEnd('findWhere');

console.time('find index');
var resultInd = _.indexOf(list, list[ind0]);
console.timeEnd('find index');
console.log(ind0, resultInd);

console.time('remove');
list.splice(resultInd, 1);
console.timeEnd('remove');

