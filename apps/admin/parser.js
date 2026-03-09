const Parser = {

parse(text){

if(text.includes('Shopee')) return this.shopee(text)
if(text.includes('Lazada')) return this.lazada(text)
if(text.includes('TikTok')) return this.tiktok(text)

return []

},

shopee(text){

return []

},

lazada(text){

return []

},

tiktok(text){

return []

}

}