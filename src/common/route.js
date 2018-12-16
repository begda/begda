let glob = require('glob')
let consola = require('consola')
let fsExtra = require('fs-extra')
let path = require('path')
const config = require('../config/index')
const rootDir = config.rootDir
const getRoutePathExtension = (key) => {
    if (key === '_') {
        return '*'
    }

    if (key.startsWith('_')) {
        return `:${key.substr(1)}`
    }

    return key
}
const DYNAMIC_ROUTE_REGEX = /^\/(:|\*)/
// 给生成好的路由按规则排序
const sortRoutes = function sortRoutes(routes) {
    routes.sort((a, b) => {
        if (!a.path.length) {
            return -1
        }
        if (!b.path.length) {
            return 1
        }
        // Order: /static, /index, /:dynamic
        // Match exact route before index: /login before /index/_slug
        if (a.path === '/') {
            return DYNAMIC_ROUTE_REGEX.test(b.path) ? -1 : 1
        }
        if (b.path === '/') {
            return DYNAMIC_ROUTE_REGEX.test(a.path) ? 1 : -1
        }

        let i
        let res = 0
        let y = 0
        let z = 0
        const _a = a.path.split('/')
        const _b = b.path.split('/')
        for (i = 0; i < _a.length; i++) {
            if (res !== 0) {
                break
            }
            y = _a[i] === '*' ? 2 : _a[i].includes(':') ? 1 : 0
            z = _b[i] === '*' ? 2 : _b[i].includes(':') ? 1 : 0
            res = y - z
            // If a.length >= b.length
            if (i === _b.length - 1 && res === 0) {
                // unless * found sort by level, then alphabetically
                res = _a[i] === '*' ? -1 : (
                    _a.length === _b.length ? a.path.localeCompare(b.path) : (_a.length - _b.length)
                )
            }
        }

        if (res === 0) {
            // unless * found sort by level, then alphabetically
            res = _a[i - 1] === '*' && _b[i] ? 1 : (
                _a.length === _b.length ? a.path.localeCompare(b.path) : (_a.length - _b.length)
            )
        }
        return res
    })

    routes.forEach((route) => {
        if (route.children) {
            sortRoutes(route.children)
        }
    })

    return routes
}
// 清理重复的路由参数
const cleanChildrenRoutes = function (routes, isChild = false) {
    let start = -1
    const routesIndex = []
    routes.forEach((route) => {
        if (/-index$/.test(route.name) || route.name === 'index') {
            // Save indexOf 'index' key in name
            const res = route.name.split('-')
            const s = res.indexOf('index')
            start = start === -1 || s < start ? s : start
            routesIndex.push(res)
        }
    })
    routes.forEach((route) => {
        route.path = isChild ? route.path.replace('/', '') : route.path
        if (route.path.includes('?')) {
            const names = route.name.split('-')
            const paths = route.path.split('/')
            if (!isChild) {
                paths.shift()
            } // clean first / for parents
            routesIndex.forEach((r) => {
                const i = r.indexOf('index') - start //  children names
                if (i < paths.length) {
                    for (let a = 0; a <= i; a++) {
                        if (a === i) {
                            paths[a] = paths[a].replace('?', '')
                        }
                        if (a < i && names[a] !== r[a]) {
                            break
                        }
                    }
                }
            })
            route.path = (isChild ? '' : '/') + paths.join('/')
        }
        route.name = route.name.replace(/-index$/, '')
        if (route.children) {
            if (route.children.find(child => child.path === '')) {
                delete route.name
            }
            route.children = cleanChildrenRoutes(route.children, true)
        }
    })
    return routes
}
let cons = glob.sync(rootDir + "/src/views/**/*.vue", {matchBase: true})
let files = cons.map(f => {
    const keys = f
        .replace(rootDir + '/src/views', '')
        .replace(/\.(vue|js)$/, '')
        .replace(/\/{2,}/g, '/')
        .split('/')
        .slice(1);
    return './' + keys.join("/") + '.vue'
})

let createRoutes = function () {
    const routes = []
    files.map(file => {

        const keys = file
        // .replace(RegExp(/^scr/), '')
            .replace(/\.(vue|js)$/, '')
            .replace(/\/{2,}/g, '/')
            .split('/')
            .slice(1);
        let dd = '@/views/' + keys.join("/") + '.vue'
        // const route = {name: '', path: '', component: '() => import('@/views/' + keys.join("/") + '.vue')'};
        // const route = {name: '', path: '', component:`() => import('${dd}')`};
        const route = {name: '', path: '', component: dd};
        let parent = routes
        // 按分割好的路径数组循环
        keys.forEach((key, i) => {
            // remove underscore only, if its the prefix 如果是前缀，则仅删除下划线
            const sanitizedKey = key.startsWith('_') ? key.substr(1) : key

            route.name = route.name
                ? route.name + '-' + sanitizedKey
                : sanitizedKey
            route.name += key === '_' ? 'all' : ''
            route.chunkName = file.replace(/\.(vue|js)$/, '')
            // route.chunkName = keys[keys.length-1]
            const child = parent.find(parentRoute => parentRoute.name === route.name)

            if (child) {
                child.children = child.children || []
                parent = child.children
                route.path = ''
            } else if (key === 'index' && i + 1 === keys.length) {
                route.path += i > 0 ? '' : '/'
            } else {
                route.path += '/' + getRoutePathExtension(key)

                if (key.startsWith('_') && key.length > 1) {
                    route.path += '?'
                }
            }
        })
        parent.push(route)
    })
    sortRoutes(routes) //排序路由
    return cleanChildrenRoutes(routes)
}

// 把路由数组替换成模板
function clone(o) {
    let temp = [];
    o.map(res => {
        if (res.children) {
            // console.log('sss',clone(res.children))
            // temp.push({name: res.name, children: clone(res.children)})
            temp.push(`{ 
                            path:'${res.path}',
                            chunkName:'${res.chunkName}',
                            component:()=>import('${res.component}'),
                            children:[${clone(res.children)}]
                            }`)
        } else {

            temp.push(`{ name:'${res.name}',
                            path:'${res.path}',
                            chunkName:'${res.chunkName}',
                            component:()=>import('${res.component}')
                            }`)
        }
    })
    return temp;
}

fsExtra.outputFile(rootDir + '/.begda/route.js', `export default [${Object.values(clone(createRoutes()))}]`, err => {
    consola.error(err) // => null

})
module.exports = function () {
    fsExtra.outputFile(
        rootDir + '/.begda/route.js',
        `export default [${Object.values(clone(createRoutes()))}]`,
        err => {
            consola.error(err) // => null

        }
    )
}
