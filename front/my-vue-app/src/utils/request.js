/*
 * @Author: Wyfkkk 2224081986@qq.com
 * @Date: 2024-09-26 15:16:16
 * @LastEditors: Wyfkkk 2224081986@qq.com
 * @LastEditTime: 2024-09-26 15:16:23
 * @FilePath: \uploadFileMy\front\my-vue-app\src\utils\request.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import axios from 'axios'

// 设置请求头
const myBaseURL = 'http://localhost:3030'

// 创建axios实例
const service = axios.create({
  baseURL: myBaseURL, // 请求头
  timeout: 60 * 1000, // 请求超时时间
})

// 响应拦截
service.interceptors.response.use(
  (response) => {
    // 返回的result不是1就用提示框提示后端返回的报错提示
    // response.data.result !== 1 ? Message.error({content: response.data.message || 'Error',duration: 5 * 1000}) : ''
    return response.data
  },
  (error) => {
    // Message.error({content: error.msg,duration: 5 * 1000});
    return Promise.reject(error)
  }
)

export default service
