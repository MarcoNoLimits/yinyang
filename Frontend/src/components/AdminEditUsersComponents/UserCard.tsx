import { useState, useEffect } from 'react';

interface UserCardProps {
    img: string;
    name: string;
    Id: string | number;
    role: boolean;
    onRoleToggle: () => void;
}

function UserCard({ img, name, Id, role, onRoleToggle }: UserCardProps) {
    console.log('UserCard props:', { img, name, Id, role }); // Debug log
    return (
        <div className="gap-4 bg-[#2F2F2F] text-[#acacaf] p-6 rounded-xl shadow-md hover:bg-[#3A3A3A] transition flex flex-col items-center">
            <div className="flex flex-col items-center">
                <div className="w-[300px] h-[300px] rounded-full overflow-hidden mb-4">
                    <img 
                        src={img} 
                        alt={name} 
                        className="w-full h-full object-cover"
                    />
                </div>
                <h3 className="text-xl font-bold text-[clamp(80%,16px,100%)]">{name}</h3>
                <p className="text-sm text-gray-400">ID: {Id}</p>
                <button 
                    className='mt-2 cursor-pointer rounded-xl p-3' 
                    style={{backgroundColor:'#4a4a4a'}} 
                    onClick={onRoleToggle}
                >
                    {role ? (
                        <img 
                            className='opacity-50 h-[30px] object-cover' 
                            src='https://www.svgrepo.com/show/154007/manager.svg'
                            alt="Moderator"
                        />
                    ) : (
                        <img 
                            className='opacity-50 h-[30px] object-cover' 
                            src='https://www.freeiconspng.com/uploads/computer-user-icon-28.png'
                            alt="User"
                        />
                    )}
                </button>
            </div>
        </div>
    );
}

export default UserCard;