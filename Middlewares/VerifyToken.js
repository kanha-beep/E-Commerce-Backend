// import jwt from 'jsonwebtoken';
// export const VerifyToken = (req, res, next) => {
//     const token = req.cookies.token;
//     console.log("got token in verify auth: ", token)
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     console.log("got user after login token: ", decoded)
//     req.user = decoded;
//     next()
// }