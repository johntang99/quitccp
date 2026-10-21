-- 删掉 041 留下的旧重载。
--
-- 041 用 `create or replace function count_dead_redirects(p_locale text default null)`
-- 加了参数。但加参数就是换签名，Postgres 把它当成**另一个**函数，035 建的无参版
-- 还在。于是 `count_dead_redirects()` 这样的无参调用同时匹配两个，报
-- 「function count_dead_redirects() is not unique」—— 自检里那一项当场就坏了。
--
-- 这个坑 040 里避开了（drop 旧的再建新的），041 里又踩了一次。两个函数、同一个
-- 道理：**给函数加参数，必须先 drop 旧签名。**
--
-- 留这条注释是因为下一个给这里加参数的人会是同样的处境。

drop function if exists count_dead_redirects();
drop function if exists list_dead_redirects(integer);
