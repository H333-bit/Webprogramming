import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'stylehub_secret';

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, enum: ['Women','Men','Accessories'], required: true },
  gender: { type: String, enum: ['Women','Men','Unisex'], default: 'Unisex' },
  sizes: [String],
  stock: { type: Number, default: 0 },
  tag: { type: String, enum: ['New In','Best Seller','Featured'], default: 'New In' },
  image: { type: String, required: true }
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['customer','admin'], default: 'customer' },
  cart: [{ product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, quantity: { type: Number, default: 1 } }],
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }]
}, { timestamps: true });

userSchema.pre('save', async function(next){
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

const Product = mongoose.model('Product', productSchema);
const User = mongoose.model('User', userSchema);

function token(user){ return jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' }); }
function safe(user){ return { id:user._id, fullName:user.fullName, email:user.email, role:user.role }; }
async function auth(req,res,next){
  try{
    const h=req.headers.authorization||'';
    const t=h.startsWith('Bearer ')?h.slice(7):null;
    if(!t) return res.status(401).json({message:'Token missing'});
    const d=jwt.verify(t,JWT_SECRET);
    const user=await User.findById(d.id).select('-password');
    if(!user) return res.status(401).json({message:'User not found'});
    req.user=user; next();
  }catch(e){res.status(401).json({message:'Invalid token'});}
}
function admin(req,res,next){ if(req.user.role!=='admin') return res.status(403).json({message:'Admin only'}); next(); }

app.get('/',(req,res)=>res.json({message:'StyleHub API running'}));
app.post('/api/auth/register', async (req,res)=>{
  try{
    const {fullName,email,password}=req.body;
    if(!fullName||!email||!password) return res.status(400).json({message:'Fill all fields'});
    if(await User.findOne({email})) return res.status(409).json({message:'Email already registered'});
    const user=await User.create({fullName,email,password,role:'customer'});
    res.status(201).json({user:safe(user),token:token(user)});
  }catch(e){res.status(500).json({message:e.message});}
});
app.post('/api/auth/login', async (req,res)=>{
  const {email,password}=req.body;
  const user=await User.findOne({email});
  if(!user || !(await bcrypt.compare(password,user.password))) return res.status(401).json({message:'Invalid email or password'});
  res.json({user:safe(user),token:token(user)});
});
app.get('/api/auth/me',auth,(req,res)=>res.json({user:req.user}));

app.get('/api/products',async(req,res)=>{
  const {category,search,sort}=req.query; const filter={};
  if(category&&category!=='All') filter.$or=[{category},{gender:category},{tag:category}];
  if(search) filter.$and=[{$or:[{name:{$regex:search,$options:'i'}},{description:{$regex:search,$options:'i'}}]}];
  let q=Product.find(filter); if(sort==='low') q=q.sort({price:1}); else if(sort==='high') q=q.sort({price:-1}); else q=q.sort({createdAt:-1});
  res.json(await q);
});
app.get('/api/products/:id',async(req,res)=>res.json(await Product.findById(req.params.id)));
app.post('/api/products',auth,admin,async(req,res)=>res.status(201).json(await Product.create(req.body)));
app.put('/api/products/:id',auth,admin,async(req,res)=>res.json(await Product.findByIdAndUpdate(req.params.id,req.body,{new:true,runValidators:true})));
app.delete('/api/products/:id',auth,admin,async(req,res)=>{await Product.findByIdAndDelete(req.params.id);res.json({message:'Product deleted'});});

app.get('/api/cart',auth,async(req,res)=>res.json((await User.findById(req.user._id).populate('cart.product')).cart));
app.post('/api/cart',auth,async(req,res)=>{
  const {productId,quantity=1}=req.body; const user=await User.findById(req.user._id);
  const item=user.cart.find(i=>i.product.toString()===productId); if(item) item.quantity+=Number(quantity); else user.cart.push({product:productId,quantity});
  await user.save(); res.json((await User.findById(req.user._id).populate('cart.product')).cart);
});
app.put('/api/cart/:productId',auth,async(req,res)=>{
  const user=await User.findById(req.user._id); const item=user.cart.find(i=>i.product.toString()===req.params.productId);
  if(Number(req.body.quantity)<=0) user.cart=user.cart.filter(i=>i.product.toString()!==req.params.productId); else if(item) item.quantity=Number(req.body.quantity);
  await user.save(); res.json((await User.findById(req.user._id).populate('cart.product')).cart);
});
app.delete('/api/cart/:productId',auth,async(req,res)=>{
  const user=await User.findById(req.user._id); user.cart=user.cart.filter(i=>i.product.toString()!==req.params.productId); await user.save();
  res.json((await User.findById(req.user._id).populate('cart.product')).cart);
});
app.get('/api/wishlist',auth,async(req,res)=>res.json((await User.findById(req.user._id).populate('wishlist')).wishlist));
app.post('/api/wishlist/:productId',auth,async(req,res)=>{
  const user=await User.findById(req.user._id); if(!user.wishlist.some(id=>id.toString()===req.params.productId)) user.wishlist.push(req.params.productId); await user.save();
  res.json((await User.findById(req.user._id).populate('wishlist')).wishlist);
});
app.delete('/api/wishlist/:productId',auth,async(req,res)=>{
  const user=await User.findById(req.user._id); user.wishlist=user.wishlist.filter(id=>id.toString()!==req.params.productId); await user.save();
  res.json((await User.findById(req.user._id).populate('wishlist')).wishlist);
});

async function seed(){
  if(await User.countDocuments()===0){ await User.create([{fullName:'Admin User',email:'admin@stylehub.com',password:'admin123',role:'admin'},{fullName:'Demo Customer',email:'customer@stylehub.com',password:'customer123',role:'customer'}]); }
  if(await Product.countDocuments()===0){ await Product.insertMany([
    {name:'Tailored Wool Coat',price:189,category:'Women',gender:'Women',sizes:['XS','S','M','L'],stock:15,tag:'New In',image:'https://images.unsplash.com/photo-1548624313-0396c75e4b1a?auto=format&fit=crop&w=900&q=80',description:'A refined wool coat with quiet luxury finish.'},
    {name:'Minimal Black Blazer',price:129,category:'Men',gender:'Men',sizes:['S','M','L','XL'],stock:22,tag:'Best Seller',image:'https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=900&q=80',description:'Structured everyday blazer.'},
    {name:'Cream Knit Sweater',price:79,category:'Women',gender:'Women',sizes:['XS','S','M','L'],stock:30,tag:'New In',image:'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80',description:'Soft premium knit sweater.'},
    {name:'Leather Crossbody Bag',price:98,category:'Accessories',gender:'Unisex',sizes:['One Size'],stock:18,tag:'Best Seller',image:'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=900&q=80',description:'Compact leather bag.'},
    {name:'Silk Evening Dress',price:149,category:'Women',gender:'Women',sizes:['XS','S','M','L'],stock:20,tag:'Featured',image:'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80',description:'Elegant silk evening dress for formal occasions.'},
    {name:'High Waist Jeans',price:69,category:'Women',gender:'Women',sizes:['XS','S','M','L'],stock:35,tag:'Best Seller',image:'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=900&q=80',description:'Comfortable high waist denim jeans.'},
    {name:'Oversized Hoodie',price:59,category:'Women',gender:'Women',sizes:['S','M','L'],stock:40,tag:'New In',image:'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80',description:'Warm oversized hoodie for casual outfits.'},
    {name:'Pleated Midi Skirt',price:64,category:'Women',gender:'Women',sizes:['XS','S','M','L'],stock:28,tag:'Featured',image:'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?auto=format&fit=crop&w=900&q=80',description:'Soft pleated midi skirt with elegant movement.'},
    {name:'Classic Trench Coat',price:159,category:'Women',gender:'Women',sizes:['S','M','L'],stock:16,tag:'Best Seller',image:'https://images.unsplash.com/photo-1520975954732-35dd22299614?auto=format&fit=crop&w=900&q=80',description:'Timeless trench coat for transitional weather.'},

    {name:'Slim Fit Suit',price:199,category:'Men',gender:'Men',sizes:['S','M','L','XL'],stock:15,tag:'Featured',image:'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=900&q=80',description:'Modern slim fit suit for smart occasions.'},
    {name:'Casual Polo Shirt',price:45,category:'Men',gender:'Men',sizes:['S','M','L','XL'],stock:50,tag:'Best Seller',image:'https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?auto=format&fit=crop&w=900&q=80',description:'Premium cotton polo shirt.'},
    {name:'Cargo Trousers',price:75,category:'Men',gender:'Men',sizes:['S','M','L','XL'],stock:25,tag:'New In',image:'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80',description:'Utility cargo trousers with relaxed styling.'},
    {name:'Denim Jacket',price:89,category:'Men',gender:'Men',sizes:['S','M','L','XL'],stock:20,tag:'Featured',image:'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=900&q=80',description:'Classic denim jacket for everyday layering.'},
    {name:'Oxford Cotton Shirt',price:55,category:'Men',gender:'Men',sizes:['S','M','L','XL'],stock:32,tag:'New In',image:'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=900&q=80',description:'Clean cotton oxford shirt with a smart casual fit.'},

    {name:'Luxury Watch',price:249,category:'Accessories',gender:'Unisex',sizes:['One Size'],stock:12,tag:'Featured',image:'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=900&q=80',description:'Classic luxury wrist watch.'},
    {name:'Leather Wallet',price:39,category:'Accessories',gender:'Unisex',sizes:['One Size'],stock:60,tag:'Best Seller',image:'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=900&q=80',description:'Genuine leather wallet.'},
    {name:'Aviator Sunglasses',price:55,category:'Accessories',gender:'Unisex',sizes:['One Size'],stock:30,tag:'New In',image:'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=900&q=80',description:'Stylish aviator sunglasses.'},
    {name:'Minimal Silver Ring',price:29,category:'Accessories',gender:'Unisex',sizes:['6','7','8','9','10'],stock:45,tag:'Featured',image:'https://images.unsplash.com/photo-1603561596112-db1d2e705df3?auto=format&fit=crop&w=900&q=80',description:'Minimal silver-tone ring for everyday wear.'},
    {name:'Canvas Tote Bag',price:34,category:'Accessories',gender:'Unisex',sizes:['One Size'],stock:38,tag:'New In',image:'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=80',description:'Durable canvas tote bag for daily use.'}
  ]); }
}

await mongoose.connect(process.env.MONGO_URI||'mongodb://localhost:27017/stylehub');
await seed();
app.listen(process.env.PORT||5000,()=>console.log('Backend running'));
