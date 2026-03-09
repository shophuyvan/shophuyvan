const ProfitAPI = {

save(report){

localStorage.setItem('profitReport',JSON.stringify(report))

},

load(){

return JSON.parse(localStorage.getItem('profitReport')||'{}')

}

}