function CartSystem(){
return{
cart: JSON.parse(localStorage.getItem("cart") || "[]"),

save(){
  localStorage.setItem("cart", JSON.stringify(this.cart));
},

add(product){
  const existing = this.cart.find(i => i.id === product.id);
  if(existing){
    existing.qty++;
  }else{
    this.cart.push({...product, qty:1});
  }
  this.save();
},

remove(id){
  this.cart = this.cart.filter(i => i.id !== id);
  this.save();
},

clear(){
  this.cart = [];
  this.save();
},

get total(){
  return this.cart.reduce((sum,i)=> sum + i.price * i.qty, 0);
}
}
}
