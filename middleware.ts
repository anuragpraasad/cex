import type { NextFunction, Response, Request } from "express"
import jwt from "jsonwebtoken"

const authMiddleware = (req : Request, res : Response, next : NextFunction) => {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith("Bearer ") ){
        return res.status(401).json({
            msg : "Access Denied",
            success : false
        })
    }
    const token = authHeader.split(" ")[1] as string

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    try{
        (req as any).userId = (decoded as any).userid
        next();
    }
    catch(e){
        return res.status(400).json({
            status :  "error",
            message : "Token as expired !! Please sign in again"
        })
    }
}

export default authMiddleware;