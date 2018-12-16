const utils = require("../common/utils")
const config=require('../config/index')
const exec = require('child_process').exec;
const rootDir=config.rootDir
utils.watcher(rootDir+'/src/views').all(()=>{

    //views目录改变的时候,启动node去生成路由文件
    const cmdStr =`node ${rootDir}/begda/src/common/route.js`;
    exec(cmdStr, function(err,stdout,stderr){
        if(err) {
            throw new Error('路由创建错误:'+stderr)
        }
    });
})


