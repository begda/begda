const path = require('path')
let fsExtra = require('fs-extra')
const getRootDir = () => {
    const isPath=path.resolve('.')

    const pathArr=isPath.split('/')

    for (let a=pathArr.length-1 ; a>=0;a--){

        let c=[]
        for(let i=0; i<=a; i++){
            c.push(pathArr[i])
        }
        let file=c.join("/")+'/begda.config.js'

        if(fsExtra.pathExistsSync(file)){

            return c.join("/")
        }
    }
}
const rootDir = getRootDir()
console.log(rootDir)
if(!rootDir){
    throw new Error(`没有找到begda.config.js 请在项目根目录创建`)
}

module.exports={
    rootDir
}