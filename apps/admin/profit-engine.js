const ProfitEngine = {

calculate(orders){

const daily = {}

orders.forEach(o=>{

if(!daily[o.date]) daily[o.date]=0

daily[o.date]+= o.revenue - o.cost

})

return {

daily:Object.keys(daily).map(d=>({

date:d,
profit:daily[d]

}))

}

},

bySKU(orders){

const map = {}

orders.forEach(o=>{

if(!map[o.sku]) map[o.sku]={

sku:o.sku,
revenue:0,
cost:0

}

map[o.sku].revenue+=o.revenue
map[o.sku].cost+=o.cost

})

return Object.values(map).map(m=>({

...m,
profit:m.revenue-m.cost

}))

}

}
