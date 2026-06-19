import { useState } from "react";
import UserCard from "./UserCard";
import { motion } from "framer-motion";

interface User {
    userId: string | number;
    username: string;
    roles: string[];
    userImg?: string;
}

interface UsersSmallBoxesBoxProps {
    users: User[];
    moderator: boolean;
    onRoleToggle: (userId: string | number) => void;
}

function UsersSmallBoxesBox({ users, moderator, onRoleToggle }: UsersSmallBoxesBoxProps) {
    const [direction, setDirection] = useState(1);
    const [page, setPage] = useState(0);
    const numPerPage = 4;

    const filteredUsers = users.filter(user => 
        user.roles && (moderator ? user.roles.includes("moderator") : user.roles.includes("user"))
    );
    
    console.log('Filtered users:', filteredUsers); // Debug log

    const maxPages = Math.ceil(filteredUsers.length / numPerPage);

    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? "100%" : "-100%",
            opacity: 0,
        }),
        center: { x: "0%", opacity: 1 },
        exit: (direction: number) => ({
            x: direction > 0 ? "-100%" : "100%",
            opacity: 0,
        }),
    };

    function pageIncrease() {
        if (page + 1 < maxPages) {
            setPage((prevPage) => prevPage + 1);
            setDirection(1);
        }
    }

    function pageDecrease() {
        if (page > 0) {
            setPage((prevPage) => prevPage - 1);
            setDirection(-1);
        }
    }

    return (
        <div className="w-[100%] flex flex-col gap-5 items-center">
            <motion.div
                key={page}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                custom={direction}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="w-[90%] items-center grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6"
            >
                {filteredUsers.slice(numPerPage * page, numPerPage * (page + 1)).map((user) => (
                    <UserCard
                        key={user.userId}
                        img={
                            user.userImg ||
                            "https://res.cloudinary.com/dx8qt8hiz/image/upload/v1746803321/Def_otuzdo.jpg"
                        }
                        name={user.username}
                        Id={user.userId}
                        role={user.roles.includes("moderator")}
                        onRoleToggle={() => onRoleToggle(user.userId)}
                    />
                ))}
            </motion.div>

            <div className="flex gap-3 items-center">
                <button
                    className="bg-[#efefef] rounded-full p-[20px] disabled:opacity-50"
                    onClick={pageDecrease}
                    disabled={page === 0}
                >
                    <img
                        src="https://img.icons8.com/?size=100&id=9149&format=png&color=000000"
                        className="w-5"
                        alt="Previous"
                    />
                </button>
                <button
                    className="bg-[#efefef] rounded-full p-[20px] disabled:opacity-50"
                    onClick={pageIncrease}
                    disabled={page + 1 >= maxPages}
                >
                    <img
                        src="https://img.icons8.com/?size=100&id=9149&format=png&color=000000"
                        className="w-5 rotate-180"
                        alt="Next"
                    />
                </button>
            </div>
        </div>
    );
}

export default UsersSmallBoxesBox;
